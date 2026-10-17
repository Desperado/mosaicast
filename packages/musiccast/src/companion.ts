import { BrowseError, validBrowseAction, validBrowseIndex } from './browsing';
import { CommandRejectedError } from './command-error';
import type { BrowseAction, BrowsePage, BrowseResult, Command, Controller, Snapshot } from './types';

export const companionVersion = 1;
export type CompanionOperation =
  | { type: 'observe' }
  | { type: 'reconcile' }
  | { type: 'release' }
  | { type: 'command'; command: Command }
  | { type: 'browse'; input: string; index: number; takeover?: boolean }
  | { type: 'browseAction'; action: BrowseAction; lease: string };
export interface CompanionRequest {
  version: 1;
  generation: string;
  sequence: number;
  operation: CompanionOperation;
}
export interface CompanionState {
  version: 1;
  generation: string;
  revision: number;
  snapshot?: Snapshot;
  freshness: 'fresh' | 'stale';
  needsReconcile: boolean;
  activity?: 'read' | 'command' | 'menu';
  menuOwner?: string;
}
export type CompanionCode = 'busy' | 'generation' | 'sequence' | 'invalid' | 'reconcile' | 'owned' | 'browseChanged' | 'browseUnavailable' | 'browseReadError' | 'offline';
export interface CompanionReply {
  sequence: number;
  outcome: 'observed' | 'accepted' | 'rejected' | 'uncertain';
  state: CompanionState;
  code?: CompanionCode;
  page?: BrowsePage;
  lease?: string;
}

export function validCommand(value: unknown): value is Command {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const c = value as Record<string, unknown>;
  if (Object.keys(c).length !== 2 || !('type' in c) || !('value' in c)) return false;
  if (c.type === 'input') return typeof c.value === 'string' && /^[a-z][a-z0-9_]{0,47}$/.test(c.value);
  if (c.type === 'tunerPreset') return typeof c.value === 'number' && Number.isInteger(c.value) && c.value >= 1 && c.value <= 256;
  if (c.type === 'bluetoothConnect') return typeof c.value === 'string' && /^[\da-f]{12}$/i.test(c.value);
  const values: Record<string, unknown[]> = { power: ['on', 'standby'], volume: ['up', 'down'], mute: [true, false], playback: ['play', 'pause', 'previous', 'next'], tunerBand: ['fm', 'dab'], tunerTune: ['up', 'down', 'auto_up', 'auto_down'], tunerService: ['previous', 'next'], tunerScan: ['start', 'cancel'], bluetoothOutput: [true, false], bluetoothScan: ['start'], bluetoothDisconnect: ['disconnect'] };
  return typeof c.type === 'string' && Object.prototype.hasOwnProperty.call(values, c.type) && values[c.type].includes(c.value);
}

export function validCompanionRequest(value: unknown): value is CompanionRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as CompanionRequest;
  if (r.version !== 1 || typeof r.generation !== 'string' || r.generation.length > 80 || !Number.isSafeInteger(r.sequence) || r.sequence < 1) return false;
  const op = r.operation;
  if (!op || typeof op !== 'object' || Array.isArray(op)) return false;
  switch (op.type) {
    case 'observe': case 'reconcile': case 'release': return Object.keys(op).length === 1;
    case 'command': return validCommand(op.command) && Object.keys(op).length === 2;
    case 'browse': return ['deezer', 'server', 'usb', 'net_radio'].includes(op.input) && validBrowseIndex(op.index) && (op.takeover === undefined || typeof op.takeover === 'boolean');
    case 'browseAction': return validBrowseAction(op.action) && typeof op.lease === 'string' && op.lease.length <= 80;
    default: return false;
  }
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
type ClientHistory = { highest: number; replies: Map<number, { signature: string; result: Promise<CompanionReply> }> };

// One instance per allowlisted receiver. No write queue, no write retries, no UI state.
export class CompanionCoordinator {
  private current: CompanionState;
  private readonly clients = new Map<string, ClientHistory>();
  private readonly listeners = new Set<(state: CompanionState) => void>();
  private lease?: { owner: string; token: string; expires: number };
  private leaseSequence = 0;
  private operating = false;
  constructor(private readonly controller: Controller, generation: string, private readonly now = Date.now) {
    this.current = { version: 1, generation, revision: 0, freshness: 'stale', needsReconcile: true };
  }
  get state(): CompanionState { return clone(this.current); }
  private invalidation = 0;
  invalidate() { this.invalidation++; this.publish({ needsReconcile: true, freshness: 'stale' }); }
  revokeClients() {
    if (this.operating) return false;
    this.clients.clear(); this.release(); return true;
  }
  lastSequence(client: string) { return this.clients.get(client)?.highest ?? 0; }
  subscribe(listener: (state: CompanionState) => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private publish(patch: Partial<CompanionState>) {
    this.current = { ...this.current, ...patch, revision: this.current.revision + 1 };
    for (const listener of this.listeners) { try { listener(this.state); } catch { /* A disconnected observer cannot interrupt a device operation. */ } }
  }
  private release() { this.lease = undefined; this.publish({ menuOwner: undefined }); }
  private reply(sequence: number, outcome: CompanionReply['outcome'], code?: CompanionCode): CompanionReply {
    return { sequence, outcome, state: this.state, ...(code ? { code } : {}) };
  }
  async poll() {
    if (this.operating) return;
    this.operating = true;
    try { this.publish({ snapshot: await this.controller.read(), freshness: 'fresh' }); }
    catch { this.publish({ freshness: 'stale' }); }
    finally { this.operating = false; }
  }
  handle(client: string, request: CompanionRequest): Promise<CompanionReply> {
    if (!validCompanionRequest(request)) return Promise.resolve(this.reply(0, 'rejected', 'invalid'));
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(client)) return Promise.resolve(this.reply(request.sequence, 'rejected', 'invalid'));
    if (request.generation !== this.current.generation) return Promise.resolve(this.reply(request.sequence, 'rejected', 'generation'));
    let history = this.clients.get(client);
    if (!history) {
      if (this.clients.size >= 8) return Promise.resolve(this.reply(request.sequence, 'rejected', 'busy'));
      history = { highest: 0, replies: new Map() }; this.clients.set(client, history);
    }
    const signature = JSON.stringify(request.operation);
    const cached = history.replies.get(request.sequence);
    if (cached) return cached.signature === signature ? cached.result.then(clone) : Promise.resolve(this.reply(request.sequence, 'rejected', 'sequence'));
    if (request.sequence <= history.highest) return Promise.resolve(this.reply(request.sequence, 'rejected', 'sequence'));
    history.highest = request.sequence;
    const result = this.perform(client, request);
    history.replies.set(request.sequence, { signature, result });
    if (history.replies.size > 64) history.replies.delete(history.replies.keys().next().value!);
    return result.then(clone);
  }
  private async perform(client: string, { sequence, operation: op }: CompanionRequest): Promise<CompanionReply> {
    if (this.operating) return this.reply(sequence, 'rejected', 'busy');
    if (this.lease && this.now() >= this.lease.expires) this.release();
    if (op.type === 'release') {
      if (this.lease?.owner === client) this.release();
      return this.reply(sequence, 'observed');
    }
    if (!['observe', 'reconcile'].includes(op.type) && (this.current.needsReconcile || this.current.freshness !== 'fresh')) return this.reply(sequence, 'rejected', 'reconcile');
    if (op.type === 'browse' && this.lease && this.lease.owner !== client && !op.takeover) return this.reply(sequence, 'rejected', 'owned');
    if (op.type === 'browseAction' && (!this.lease || this.lease.owner !== client || this.lease.token !== op.lease)) return this.reply(sequence, 'rejected', 'browseChanged');
    const invalidation = this.invalidation;
    this.operating = true;
    this.publish({ activity: op.type === 'command' ? 'command' : op.type.startsWith('browse') ? 'menu' : 'read' });
    let page: BrowsePage | undefined;
    let outcome: CompanionReply['outcome'] = 'observed', code: CompanionCode | undefined;
    try {
      if (op.type === 'observe' || op.type === 'reconcile') {
        const snapshot = await this.controller.read();
        if (op.type === 'reconcile') this.release();
        this.publish({ snapshot, freshness: 'fresh', ...(op.type === 'reconcile' ? { needsReconcile: false } : {}) });
      } else if (op.type === 'command') {
        const snapshot = await this.controller.execute(op.command);
        if (op.command.type === 'input' || op.command.type === 'power') this.release();
        this.publish({ snapshot, freshness: 'fresh' });
        if ((op.command.type === 'playback' && ['next', 'previous'].includes(op.command.value)) || ['tunerTune', 'tunerService', 'tunerPreset', 'tunerScan'].includes(op.command.type)) outcome = 'accepted';
      } else {
        if (op.type === 'browse') {
          this.lease = { owner: client, token: String(++this.leaseSequence), expires: this.now() + 45000 };
          this.publish({ menuOwner: client });
          page = await this.controller.browse(op.input, op.index);
        } else {
          const result = await this.controller.browseAction(op.action);
          page = result.page;
          if (result.snapshot) this.publish({ snapshot: result.snapshot, freshness: 'fresh' });
          if (op.action.type === 'play') outcome = 'accepted';
        }
        this.lease!.expires = this.now() + 45000;
      }
    } catch (error) {
      const browseCode = error instanceof BrowseError ? error.code : undefined;
      const uncertain = (op.type === 'command' && !(error instanceof CommandRejectedError)) || (op.type === 'browseAction' && (!browseCode || browseCode === 'uncertainError'));
      if (uncertain) {
        outcome = 'uncertain'; this.release(); this.publish({ freshness: 'stale', needsReconcile: true });
      } else {
        outcome = 'rejected'; code = error instanceof CommandRejectedError ? 'invalid' : browseCode === 'browseChanged' || browseCode === 'browseUnavailable' || browseCode === 'browseReadError' ? browseCode : 'offline';
        if (op.type.startsWith('browse')) this.release();
        else this.publish({ freshness: 'stale' });
      }
    } finally {
      if (invalidation !== this.invalidation) { this.release(); this.publish({ freshness: 'stale', needsReconcile: true }); }
      this.operating = false; this.publish({ activity: undefined });
    }
    return { ...this.reply(sequence, outcome, code), ...(page ? { page, lease: this.lease?.token } : {}) };
  }
}

export type CompanionExchange = (request?: CompanionRequest) => Promise<CompanionReply>;
export class CompanionError extends Error {
  constructor(readonly code: CompanionCode | 'uncertain') { super(code); this.name = 'CompanionError'; }
}

// Both frontends use the same no-replay client. Credentials belong to the transport.
export class CompanionController implements Controller {
  readonly mode = 'device' as const;
  private sequence = 0;
  private current?: CompanionState;
  private lease = '';
  private operating = false;
  private uncertain = false;
  private active = true;
  private observing?: Promise<CompanionState>;
  private readonly observers = new Set<(state: { snapshot?: Snapshot; stale: boolean; needsRefresh: boolean }) => void>();
  setActive(active: boolean) { this.active = active; }
  private emit(stale = this.current?.freshness !== 'fresh') {
    for (const listener of this.observers) listener({ snapshot: this.current?.snapshot, stale, needsRefresh: this.uncertain || !!this.current?.needsReconcile });
  }
  watch(listener: (state: { snapshot?: Snapshot; stale: boolean; needsRefresh: boolean }) => void) {
    this.observers.add(listener); this.emit();
    const timer = setInterval(() => {
      if (!this.active || this.operating) return;
      void this.observe().catch(() => this.emit(true));
    }, 500);
    return () => { clearInterval(timer); this.observers.delete(listener); };
  }
  constructor(readonly host: string, private readonly exchange: CompanionExchange, private readonly notify: (state: CompanionState) => void = () => {}) {}
  get state() { return this.current; }
  async observe(): Promise<CompanionState> {
    if (this.observing) return this.observing;
    if (this.operating && this.current) return this.current;
    this.observing = (async () => {
      const reply = await this.exchange();
      this.accept(reply.state);
      this.sequence = Math.max(this.sequence, reply.sequence);
      return this.current!;
    })();
    try { return await this.observing; } finally { this.observing = undefined; }
  }
  private accept(state: CompanionState) {
    if (state.version !== 1) throw new CompanionError('invalid');
    if (!this.current || state.generation !== this.current.generation || state.revision > this.current.revision) {
      if (this.current && state.generation !== this.current.generation) { this.sequence = 0; this.lease = ''; this.uncertain = true; }
      this.current = state; this.notify(state); this.emit();
    }
  }
  private async operation(op: CompanionOperation): Promise<CompanionReply> {
    if (this.operating) throw new CompanionError('busy');
    const writing = op.type === 'command' || op.type === 'browseAction';
    if (writing && this.uncertain) throw new CompanionError('reconcile');
    this.operating = true;
    try {
      if (this.observing) await this.observing;
      if (!this.current) await this.observe();
      if (writing && this.uncertain) throw new CompanionError('reconcile');
      const request: CompanionRequest = { version: 1, generation: this.current!.generation, sequence: ++this.sequence, operation: op };
      let reply: CompanionReply;
      try { reply = await this.exchange(request); }
      catch { if (writing) this.uncertain = true; throw new CompanionError(writing ? 'uncertain' : 'offline'); }
      this.accept(reply.state);
      if (reply.outcome === 'uncertain') { this.uncertain = true; throw new CompanionError('uncertain'); }
      if (reply.outcome === 'rejected') {
        if (op.type.startsWith('browse') && ['owned', 'busy'].includes(reply.code ?? '')) throw new BrowseError(reply.code === 'owned' ? 'companionOwned' : 'companionBusy');
        if (['browseChanged', 'browseUnavailable', 'browseReadError'].includes(reply.code ?? '')) throw new BrowseError(reply.code as 'browseChanged' | 'browseUnavailable' | 'browseReadError');
        throw new CompanionError(reply.code ?? 'invalid');
      }
      if (op.type === 'reconcile') this.uncertain = false;
      if (reply.lease) this.lease = reply.lease;
      return reply;
    } finally { this.operating = false; this.emit(); }
  }
  async read() { const state = await this.observe(); if (!state.snapshot || state.freshness !== 'fresh') throw new CompanionError('offline'); return state.snapshot; }
  async reconcile() { const r = await this.operation({ type: 'reconcile' }); if (!r.state.snapshot) throw new CompanionError('offline'); return r.state.snapshot; }
  async execute(command: Command) { const r = await this.operation({ type: 'command', command }); if (!r.state.snapshot) throw new CompanionError('offline'); return r.state.snapshot; }
  async browse(input: string, index = 0, takeover = false) { const r = await this.operation({ type: 'browse', input, index, takeover }); if (!r.page) throw new CompanionError('browseReadError'); return r.page; }
  async releaseBrowse() { await this.operation({ type: 'release' }); this.lease = ''; }
  async browseAction(action: BrowseAction): Promise<BrowseResult> {
    const r = await this.operation({ type: 'browseAction', action, lease: this.lease });
    if (!r.page) throw new CompanionError('browseReadError');
    return { page: r.page, snapshot: r.state.snapshot };
  }
}
