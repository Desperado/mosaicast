import { BrowseError, type BrowseErrorCode } from './browsing';
import { CompanionError } from './companion';
import { CommandRejectedError } from './command-error';
import type { BrowseAction, BrowsePage, Command, Controller, Snapshot } from './types';

export interface DeviceState {
  host?: string;
  snapshot?: Snapshot;
  phase: 'disconnected' | 'connecting' | 'connected' | 'stale';
  busy: boolean;
  pendingCommand?: Command;
  refreshing?: boolean;
  needsRefresh: boolean;
  error?: 'connectError' | 'bridgeError' | 'readError' | 'uncertainError' | 'companionBusy' | 'commandRejected';
  outcome?: 'confirmed' | 'accepted';
  browse?: BrowsePage;
  browseError?: BrowseErrorCode;
  browseAccepted?: boolean;
}

// Owns one connection. Generation checks discard replies after disconnect or replacement.
export class DeviceSession {
  state: DeviceState = { phase: 'disconnected', busy: false, needsRefresh: false };
  private controller?: Controller;
  private generation = 0;
  private stopWatching?: () => void;
  constructor(private readonly create: (host: string) => Controller, private readonly notify: (state: DeviceState) => void = () => {}) {}
  private update(patch: Partial<DeviceState>) { this.state = { ...this.state, ...patch }; this.notify(this.state); }

  async connect(host: string): Promise<boolean> {
    if (this.state.busy) return false;
    const generation = ++this.generation;
    this.stopWatching?.();
    this.controller?.close?.();
    this.controller = undefined;
    this.state = { host, phase: 'connecting', busy: true, needsRefresh: false };
    this.notify(this.state);
    let created: Controller | undefined;
    try {
      const controller = this.create(host); created = controller;
      const snapshot = await controller.read();
      if (generation !== this.generation) { controller.close?.(); return false; }
      this.controller = controller;
      this.update({ snapshot, phase: 'connected', busy: false });
      this.stopWatching = controller.watch?.(observed => {
        if (generation !== this.generation) return;
        this.update({ ...(observed.snapshot ? { snapshot: observed.snapshot } : {}),
          phase: observed.stale ? 'stale' : 'connected', needsRefresh: observed.needsRefresh || this.state.needsRefresh,
          ...(observed.needsRefresh ? { error: 'uncertainError' } : {}) });
      });
      return true;
    } catch (error) {
      created?.close?.();
      if (generation === this.generation) this.update({ phase: 'disconnected', busy: false, error: error instanceof Error && error.name === 'BridgeUnavailableError' ? 'bridgeError' : 'connectError' });
      return false;
    }
  }

  setActive(active: boolean) { this.controller?.setActive?.(active); }

  disconnect() {
    this.stopWatching?.(); this.stopWatching = undefined;
    this.controller?.close?.();
    ++this.generation;
    this.controller = undefined;
    this.state = { phase: 'disconnected', busy: false, needsRefresh: false };
    this.notify(this.state);
  }

  async refresh(explicit = true) {
    if (!this.controller || this.state.busy || (!explicit && this.state.needsRefresh)) return;
    const generation = this.generation;
    this.update({ busy: true, refreshing: explicit, outcome: undefined });
    try {
      const snapshot = await (explicit && this.controller.reconcile ? this.controller.reconcile() : this.controller.read());
      if (generation === this.generation) this.update({ snapshot, phase: 'connected', needsRefresh: !explicit && this.state.needsRefresh, error: !explicit && this.state.needsRefresh ? 'uncertainError' : undefined,
        ...(this.state.needsRefresh ? { browse: undefined, browseError: undefined, browseAccepted: false } : {}) });
    } catch (error) {
      if (generation === this.generation) this.update({ phase: 'stale', error: this.state.needsRefresh ? 'uncertainError' : error instanceof Error && error.name === 'BridgeUnavailableError' ? 'bridgeError' : 'readError' });
    } finally { if (generation === this.generation) this.update({ busy: false, refreshing: false }); }
  }

  async execute(command: Command) {
    if (!this.controller || this.state.busy || this.state.phase !== 'connected' || this.state.needsRefresh) return;
    const generation = this.generation;
    this.update({ busy: true, pendingCommand: command, error: undefined, outcome: undefined });
    try {
      const snapshot = await this.controller.execute(command);
      if (generation === this.generation) this.update({ snapshot, outcome: (command.type === 'playback' && ['next', 'previous'].includes(command.value)) || ['tunerTune', 'tunerService', 'tunerPreset', 'tunerScan'].includes(command.type) ? 'accepted' : 'confirmed' });
    } catch (error) {
      if (generation === this.generation) {
        if (error instanceof CommandRejectedError || (error instanceof CompanionError && ['busy', 'invalid', 'sequence'].includes(error.code))) {
          this.update({ error: error instanceof CompanionError && error.code === 'busy' ? 'companionBusy' : 'commandRejected' });
        } else this.update({ phase: 'stale', needsRefresh: true, error: 'uncertainError' });
      }
    } finally { if (generation === this.generation) this.update({ busy: false, pendingCommand: undefined }); }
  }

  async loadBrowse(input: string, index = 0, takeover = false) {
    if (!this.controller || this.state.busy || this.state.phase !== 'connected' || this.state.needsRefresh) return;
    const generation = this.generation;
    this.update({ busy: true, browseError: undefined, browseAccepted: false });
    try {
      const browse = await this.controller.browse(input, index, takeover);
      if (generation === this.generation) this.update({ browse });
    } catch (error) {
      if (generation === this.generation) this.update({ browse: undefined, browseError: error instanceof BrowseError ? error.code : 'browseReadError' });
    } finally { if (generation === this.generation) this.update({ busy: false }); }
  }

  async browseAction(action: BrowseAction) {
    if (!this.controller || this.state.busy || this.state.phase !== 'connected' || this.state.needsRefresh) return;
    const generation = this.generation;
    this.update({ busy: true, browseError: undefined, browseAccepted: false });
    try {
      const result = await this.controller.browseAction(action);
      if (generation === this.generation) this.update({ browse: result.page, ...(result.snapshot ? { snapshot: result.snapshot } : {}), browseAccepted: action.type === 'play' });
    } catch (error) {
      const code = error instanceof BrowseError ? error.code : 'uncertainError';
      if (generation === this.generation) this.update({ browse: undefined, browseError: code,
        ...(code === 'uncertainError' ? { phase: 'stale', needsRefresh: true, error: 'uncertainError' } : {}) });
    } finally { if (generation === this.generation) this.update({ busy: false }); }
  }
}
