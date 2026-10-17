import type { Command, Controller, Snapshot } from './types';

export interface DeviceState {
  host?: string;
  snapshot?: Snapshot;
  phase: 'disconnected' | 'connecting' | 'connected' | 'stale';
  busy: boolean;
  needsRefresh: boolean;
  error?: 'connectError' | 'bridgeError' | 'readError' | 'uncertainError';
  outcome?: 'confirmed' | 'accepted' | 'bluetoothSearchStarted';
}

// Owns one connection. Generation checks discard replies after disconnect or replacement.
export class DeviceSession {
  state: DeviceState = { phase: 'disconnected', busy: false, needsRefresh: false };
  private controller?: Controller;
  private generation = 0;
  private refreshing?: Promise<void>;
  private nextPoll = 0;
  private pollFailures = 0;
  private scanUntil = 0;
  constructor(private readonly create: (host: string) => Controller, private readonly notify: (state: DeviceState) => void = () => {}, private readonly now = Date.now) {}
  private update(patch: Partial<DeviceState>) { this.state = { ...this.state, ...patch }; this.notify(this.state); }

  private schedulePoll(failed = false) {
    this.pollFailures = failed ? this.pollFailures + 1 : 0;
    const scanning = this.state.snapshot?.bluetooth?.updating && this.now() < this.scanUntil;
    this.nextPoll = this.now() + (failed ? Math.min(120000, 30000 * 2 ** this.pollFailures) : scanning ? 3000 : 30000);
  }

  // The app may check often; only an eligible idle session actually reads Yamaha.
  async poll() {
    if (this.now() >= this.nextPoll) await this.refresh(false);
  }

  async connect(host: string): Promise<boolean> {
    if (this.state.busy) return false;
    const generation = ++this.generation;
    this.refreshing = undefined;
    this.scanUntil = 0;
    this.controller = undefined;
    this.state = { host, phase: 'connecting', busy: true, needsRefresh: false };
    this.notify(this.state);
    try {
      const controller = this.create(host);
      const snapshot = await controller.read();
      if (generation !== this.generation) return false;
      this.controller = controller;
      this.update({ snapshot, phase: 'connected', busy: false });
      this.schedulePoll();
      return true;
    } catch (error) {
      if (generation === this.generation) this.update({ phase: 'disconnected', busy: false, error: error instanceof Error && error.name === 'BridgeUnavailableError' ? 'bridgeError' : 'connectError' });
      return false;
    }
  }

  disconnect() {
    ++this.generation;
    this.refreshing = undefined;
    this.scanUntil = 0;
    this.controller = undefined;
    this.state = { phase: 'disconnected', busy: false, needsRefresh: false };
    this.notify(this.state);
  }

  async refresh(explicit = true) {
    if (!this.controller || this.state.busy || (!explicit && this.state.needsRefresh)) return;
    if (this.refreshing) return this.refreshing;
    const generation = this.generation;
    const controller = this.controller;
    if (explicit) this.update({ busy: true, outcome: undefined });
    const request = (async () => {
      let failed = false;
      try {
        const snapshot = await controller.read();
        if (generation === this.generation) this.update({ snapshot, phase: 'connected', needsRefresh: false, error: undefined });
      } catch (error) {
        failed = true;
        if (generation === this.generation) this.update({ phase: 'stale', error: this.state.needsRefresh ? 'uncertainError' : error instanceof Error && error.name === 'BridgeUnavailableError' ? 'bridgeError' : 'readError' });
      } finally {
        if (generation === this.generation) {
          this.schedulePoll(failed);
          if (explicit) this.update({ busy: false });
        }
      }
    })();
    this.refreshing = request;
    try { await request; }
    finally { if (this.refreshing === request) this.refreshing = undefined; }
  }

  async execute(command: Command) {
    if (!this.controller || this.state.busy || this.state.phase !== 'connected' || this.state.needsRefresh) return;
    const generation = this.generation;
    this.update({ busy: true, error: undefined, outcome: undefined });
    try {
      // Reserve the tap immediately, then wait for an in-flight silent read.
      // Never overlap device work or silently discard an enabled control's tap.
      await this.refreshing;
      if (generation !== this.generation || this.state.phase !== 'connected' || this.state.needsRefresh) return;
      const snapshot = await this.controller.execute(command);
      if (generation === this.generation) {
        if (command.type === 'bluetoothScan') this.scanUntil = this.now() + 30000;
        this.update({ snapshot, outcome: command.type === 'bluetoothScan' ? 'bluetoothSearchStarted' : command.type === 'playback' && ['next', 'previous'].includes(command.value) ? 'accepted' : 'confirmed' });
      }
    } catch {
      // Conservatively treat every failed command as uncertain; never replay it.
      if (generation === this.generation) this.update({ phase: 'stale', needsRefresh: true, error: 'uncertainError' });
    } finally {
      if (generation === this.generation) {
        if (this.state.phase === 'connected' && !this.state.needsRefresh) this.schedulePoll();
        this.update({ busy: false });
      }
    }
  }
}
