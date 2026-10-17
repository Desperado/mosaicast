import { CompanionCoordinator, type CompanionExchange, type CompanionReply, type CompanionRequest } from './companion';
import { privateIPv4 } from './parsers';
import { openPeer, peerCommit, peerKeyPair, peerRandomHex, peerSAS, peerSharedKey, peerTranscript, sealPeer, type PeerPacket, type PeerRandom, type PeerRecord } from './peer-crypto';

export function peerURL(value: string): boolean {
  try { const u = new URL(value); return privateIPv4(u.hostname) && u.protocol === 'http:' && u.port === '8095' && value === u.origin && !u.username && !u.password; }
  catch { return false; }
}
export function validPeer(value: unknown): value is PeerRecord {
  const r = value as PeerRecord;
  return !!r && typeof r.id === 'string' && /^[a-f0-9]{32}$/.test(r.id) && typeof r.key === 'string' && /^[a-f0-9]{64}$/.test(r.key) && privateIPv4(r.receiver) && peerURL(r.url);
}
type Pending = ReturnType<typeof peerKeyPair> & { id: string; commit: string; expires: number; key?: string; approved: boolean };
export class PhonePeerService {
  readonly epoch: string;
  private pending?: Pending;
  private record?: PeerRecord;
  private session?: { epoch: string; counter: number };
  private granted: boolean;
  private attempts = 0;
  private attemptWindow = 0;
  private active = true;
  private leaseUntil = 0;
  private explicit = false;
  private confirming = false;
  private sessionNonces = new Set<string>();
  constructor(readonly receiver: string, readonly url: string, readonly coordinator: CompanionCoordinator, private readonly random: PeerRandom,
    record: PeerRecord | undefined, private readonly persist: (record: PeerRecord) => Promise<void>, private readonly now = Date.now) {
    if (!privateIPv4(receiver) || !peerURL(url)) throw new Error('Invalid peer host');
    this.epoch = peerRandomHex(random, 16);
    this.record = validPeer(record) && record.receiver === receiver ? record : undefined;
    this.granted = !this.record;
  }
  get pairing() {
    const p = this.pending;
    return p?.key && p.expires > this.now() ? { comparison: peerSAS(p.key), approved: p.approved } : undefined;
  }
  get paired() { return !!this.record; }
  get waitingForTV() { return !this.canControl; }
  get canControl() {
    if (this.granted && this.record && !this.explicit && this.now() >= this.leaseUntil) { this.granted = false; this.session = undefined; this.coordinator.invalidate(); }
    return this.active && this.granted;
  }
  approve() { if (!this.pairing) throw new Error('Pairing expired'); this.pending!.approved = true; }
  cancelPairing() { this.pending?.secret.fill(0); this.pending = undefined; }
  close() { this.active = false; this.cancelPairing(); this.session = undefined; this.granted = false; }
  // Explicit user takeover is required when a paired TV cannot acknowledge yielding.
  // A partition cannot be distinguished from the TV being off without a third arbiter.
  takeControl() { if (!this.active) throw new Error('Inactive'); this.coordinator.invalidate(); this.granted = true; this.explicit = true; }
  localExchange: CompanionExchange = async request => {
    if (!this.active) throw new Error('Inactive');
    if (request && !this.canControl && request.operation.type !== 'observe') return { sequence: request.sequence, outcome: 'rejected', code: 'offline', state: { ...this.coordinator.state, freshness: 'stale', needsReconcile: true } };
    const reply = request ? await this.coordinator.handle('phone', request) : { sequence: this.coordinator.lastSequence('phone'), outcome: 'observed' as const, state: this.coordinator.state };
    return this.canControl ? reply : { ...reply, state: { ...reply.state, needsReconcile: true } };
  };
  async handle(method: string, path: string, body: unknown): Promise<unknown> {
    if (!this.active) throw new Error('Inactive');
    if (method === 'GET' && path === '/.well-known/mosaicast-peer') return { service: 'mosaicast-peer', version: 1, url: this.url, epoch: this.epoch };
    if (method !== 'POST') throw new Error('Unavailable');
    if (path === '/peer/pair/start') {
      if (this.now() - this.attemptWindow >= 60000) { this.attemptWindow = this.now(); this.attempts = 0; }
      if (++this.attempts > 10 || (this.pending && this.pending.expires > this.now())) throw new Error('Pairing busy');
      const commit = (body as { commit?: unknown })?.commit;
      if (typeof commit !== 'string' || !/^[a-f0-9]{64}$/.test(commit)) throw new Error('Invalid pairing');
      const pair = peerKeyPair(this.random), id = peerRandomHex(this.random, 16);
      this.pending = { ...pair, id, commit, expires: this.now() + 120000, approved: false };
      return { id, receiver: this.receiver, publicKey: pair.publicKey, nonce: pair.nonce };
    }
    if (path === '/peer/pair/reveal') {
      const value = body as { id: string; publicKey: string; nonce: string };
      const p = this.pending;
      if (!p || p.key || p.expires <= this.now() || value?.id !== p.id || peerCommit(value.publicKey, value.nonce) !== p.commit) throw new Error('Invalid pairing');
      p.key = peerSharedKey(p.secret, value.publicKey, peerTranscript(p.id, this.receiver, p.publicKey, p.nonce, value.publicKey, value.nonce));
      p.secret.fill(0);
      return { ready: true };
    }
    if (path === '/peer/pair/confirm') {
      const packet = body as PeerPacket, p = this.pending;
      if (this.confirming || !p?.key || !p.approved || p.expires <= this.now() || packet?.id !== p.id || packet.epoch !== this.epoch || packet.counter !== 1) throw new Error('Pairing not approved');
      const clear = openPeer(p.key, packet, 'request') as { confirm?: unknown };
      if (clear?.confirm !== true || this.coordinator.state.activity) throw new Error('Pairing busy');
      const record = { id: p.id, key: p.key, receiver: this.receiver, url: this.url };
      this.confirming = true; this.granted = false; this.explicit = false; this.coordinator.invalidate();
      try {
        await this.persist(record);
        if (!this.active || this.pending !== p) throw new Error('Pairing cancelled');
        this.record = record; this.session = undefined;
        const result = sealPeer(p.key, packet, { paired: true, receiver: this.receiver }, this.random, 'response');
        this.cancelPairing(); return result;
      } finally { this.confirming = false; }
    }
    const packet = body as PeerPacket, record = this.record;
    if (!record || packet?.id !== record.id) throw new Error('Unpaired');
    const clear = openPeer(record.key, packet, 'request') as { yield?: unknown; request?: CompanionRequest };
    if (path === '/peer/session') {
      if (packet.epoch !== this.epoch || packet.counter !== 1 || this.sessionNonces.has(packet.nonce) || this.sessionNonces.size >= 4096) throw new Error('Invalid session');
      void this.canControl; // Expire the previous lease before installing a new session.
      this.sessionNonces.add(packet.nonce);
      this.session = { epoch: peerRandomHex(this.random, 16), counter: 0 };
      return sealPeer(record.key, packet, { session: this.session.epoch }, this.random, 'response');
    }
    const session = this.session;
    if (path !== '/peer/exchange' || !session || packet.epoch !== session.epoch || packet.counter <= session.counter) throw new Error('Invalid session');
    session.counter = packet.counter;
    // Check the old lease before renewal; a late heartbeat cannot revive authority.
    const hadAuthority = this.canControl;
    if (clear?.yield === true) { this.coordinator.invalidate(); this.granted = true; this.explicit = false; this.leaseUntil = this.now() + 12000; await this.coordinator.poll(); }
    else if (hadAuthority) this.leaseUntil = this.now() + 12000;
    // The TV must drain its local operation before sending yield. Never infer yield from discovery.
    let reply: CompanionReply;
    if (!this.canControl) reply = { sequence: 0, outcome: 'rejected', code: 'reconcile', state: { ...this.coordinator.state, needsReconcile: true, freshness: 'stale' } };
    else reply = clear?.request ? await this.coordinator.handle('frame', clear.request) : { sequence: this.coordinator.lastSequence('frame'), outcome: 'observed', state: this.coordinator.state };
    return sealPeer(record.key, packet, reply, this.random, 'response');
  }
}

const peerOperationTimeout = 110000;
async function peerJSON(url: string, path: string, body: unknown, fetcher: typeof fetch, timeout: number): Promise<unknown> {
  if (!peerURL(url)) throw new Error('Invalid peer address');
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), timeout);
  try {
    const response = await fetcher(url + path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: abort.signal, redirect: 'error', credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('Peer unavailable');
    const text = await response.text();
    if (text.length > 600000) throw new Error('Invalid peer response');
    return JSON.parse(text);
  } finally { clearTimeout(timer); }
}
export async function beginPeerPairing(url: string, random: PeerRandom, fetcher: typeof fetch = (...args) => globalThis.fetch(...args)) {
  const client = peerKeyPair(random);
  try {
    const info = await peerJSON(url, '/.well-known/mosaicast-peer', undefined, fetcher, 1500) as { epoch: string };
    const host = await peerJSON(url, '/peer/pair/start', { commit: peerCommit(client.publicKey, client.nonce) }, fetcher, 3000) as { id: string; publicKey: string; nonce: string; receiver: string };
    if (!/^[a-f0-9]{32}$/.test(host.id) || !/^[a-f0-9]{64}$/.test(host.nonce) || !privateIPv4(host.receiver) || !/^[a-f0-9]{32}$/.test(info.epoch)) throw new Error('Invalid pairing');
    const key = peerSharedKey(client.secret, host.publicKey, peerTranscript(host.id, host.receiver, host.publicKey, host.nonce, client.publicKey, client.nonce));
    await peerJSON(url, '/peer/pair/reveal', { id: host.id, publicKey: client.publicKey, nonce: client.nonce }, fetcher, 3000);
    return { comparison: peerSAS(key), confirm: async (): Promise<PeerRecord> => {
      const packet = sealPeer(key, { id: host.id, epoch: info.epoch, counter: 1 }, { confirm: true }, random, 'request');
      const response = await peerJSON(url, '/peer/pair/confirm', packet, fetcher, 3000) as PeerPacket;
      if (response.id !== packet.id || response.epoch !== packet.epoch || response.counter !== packet.counter) throw new Error('Invalid pairing');
      const clear = openPeer(key, response, 'response') as { paired?: unknown; receiver?: unknown };
      if (clear.paired !== true || clear.receiver !== host.receiver) throw new Error('Invalid pairing');
      return { id: host.id, key, receiver: host.receiver, url };
    } };
  } finally { client.secret.fill(0); }
}
export async function connectPeer(record: PeerRecord, random: PeerRandom, fetcher: typeof fetch = (...args) => globalThis.fetch(...args)): Promise<CompanionExchange> {
  if (!validPeer(record)) throw new Error('Invalid pairing');
  const info = await peerJSON(record.url, '/.well-known/mosaicast-peer', undefined, fetcher, 1500) as { epoch: string };
  const packet = sealPeer(record.key, { id: record.id, epoch: info.epoch, counter: 1 }, {}, random, 'request');
  const response = await peerJSON(record.url, '/peer/session', packet, fetcher, 2000) as PeerPacket;
  if (response.id !== packet.id || response.epoch !== packet.epoch || response.counter !== packet.counter) throw new Error('Invalid session');
  const { session } = openPeer(record.key, response, 'response') as { session: string };
  if (!/^[a-f0-9]{32}$/.test(session)) throw new Error('Invalid session');
  let counter = 0, yielded = false;
  return async request => {
    const sequence = ++counter;
    const envelope = sealPeer(record.key, { id: record.id, epoch: session, counter: sequence }, { ...(yielded ? {} : { yield: true }), ...(request ? { request } : {}) }, random, 'request');
    // A menu action may chain two 35s menu reads with other Yamaha requests (~100s);
    // observations, including the yield that makes the phone read Yamaha, are shorter.
    const reply = await peerJSON(record.url, '/peer/exchange', envelope, fetcher, request ? peerOperationTimeout : 30000) as PeerPacket;
    if (reply.id !== envelope.id || reply.epoch !== session || reply.counter !== sequence) throw new Error('Invalid response');
    const value = openPeer(record.key, reply, 'response') as CompanionReply;
    if (!value?.state || value.state.version !== 1 || !['observed', 'accepted', 'rejected', 'uncertain'].includes(value.outcome)) throw new Error('Invalid response');
    yielded = true; return value;
  };
}
