import type { Command, Controller, Snapshot } from './types';

export interface DeviceState {
  host?: string;
  snapshot?: Snapshot;
  phase: 'disconnected' | 'connecting' | 'connected' | 'stale';
  busy: boolean;
  needsRefresh: boolean;
  error?: 'connectError' | 'bridgeError' | 'readError' | 'uncertainError';
  outcome?: 'confirmed' | 'accepted';
}

// Owns one connection. Generation checks discard replies after disconnect or replacement.
export class DeviceSession {
  state: DeviceState = { phase: 'disconnected', busy: false, needsRefresh: false };
  private controller?: Controller;
  private generation = 0;
  constructor(private readonly create: (host: string) => Controller, private readonly notify: (state: DeviceState) => void = () => {}) {}
  private update(patch: Partial<DeviceState>) { this.state = { ...this.state, ...patch }; this.notify(this.state); }

  async connect(host: string): Promise<boolean> {
    if (this.state.busy) return false;
    const generation = ++this.generation;
    this.controller = undefined;
    this.state = { host, phase: 'connecting', busy: true, needsRefresh: false };
    this.notify(this.state);
    try {
      const controller = this.create(host);
      const snapshot = await controller.read();
      if (generation !== this.generation) return false;
      this.controller = controller;
      this.update({ snapshot, phase: 'connected', busy: false });
      return true;
    } catch (error) {
      if (generation === this.generation) this.update({ phase: 'disconnected', busy: false, error: error instanceof Error && error.name === 'BridgeUnavailableError' ? 'bridgeError' : 'connectError' });
      return false;
    }
  }

  disconnect() {
    ++this.generation;
    this.controller = undefined;
    this.state = { phase: 'disconnected', busy: false, needsRefresh: false };
    this.notify(this.state);
  }

  async refresh(explicit = true) {
    if (!this.controller || this.state.busy || (!explicit && this.state.needsRefresh)) return;
    const generation = this.generation;
    this.update({ busy: true, outcome: undefined });
    try {
      const snapshot = await this.controller.read();
      if (generation === this.generation) this.update({ snapshot, phase: 'connected', needsRefresh: false, error: undefined });
    } catch (error) {
      if (generation === this.generation) this.update({ phase: 'stale', error: this.state.needsRefresh ? 'uncertainError' : error instanceof Error && error.name === 'BridgeUnavailableError' ? 'bridgeError' : 'readError' });
    } finally { if (generation === this.generation) this.update({ busy: false }); }
  }

  async execute(command: Command) {
    if (!this.controller || this.state.busy || this.state.phase !== 'connected' || this.state.needsRefresh) return;
    const generation = this.generation;
    this.update({ busy: true, error: undefined, outcome: undefined });
    try {
      const snapshot = await this.controller.execute(command);
      if (generation === this.generation) this.update({ snapshot, outcome: command.type === 'playback' && ['next', 'previous'].includes(command.value) ? 'accepted' : 'confirmed' });
    } catch {
      // Conservatively treat every failed command as uncertain; never replay it.
      if (generation === this.generation) this.update({ phase: 'stale', needsRefresh: true, error: 'uncertainError' });
    } finally { if (generation === this.generation) this.update({ busy: false }); }
  }
}
