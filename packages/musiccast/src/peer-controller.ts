import { MusicCastClient } from './client';
import { CompanionController, CompanionCoordinator, type CompanionExchange } from './companion';
import { connectPeer } from './peer';
import { peerRandomHex, type PeerRandom, type PeerRecord } from './peer-crypto';

// Fence at dispatch, including writes issued after an awaited Yamaha preflight.
// Reads may finish after losing authority; writes may not start then.
export function peerDeviceFetch(allowed: () => boolean, fetcher: typeof fetch = (...args) => globalThis.fetch(...args)): typeof fetch {
  return (url, init) => {
    const route = String(url).split('/YamahaExtendedControl/v1/')[1]?.split('?')[0];
    if (route && !/^[a-z]+\/get[A-Z]/.test(route) && !allowed()) return Promise.reject(new Error('Coordinator changed. Refresh first.'));
    return fetcher(url, init);
  };
}

// One phone and one TV on a home LAN. The TV drains its operation before yielding.
// After losing the phone, it waits for the 12s phone lease plus in-flight HTTP
// work (5s write timeout and delayed reads) before permitting local reconciliation.
export function createTVPeerController(record: PeerRecord, random: PeerRandom, urls: () => string[], fetcher: typeof fetch = (...args) => globalThis.fetch(...args), now = Date.now) {
  let active = true, closed = false, remote: CompanionExchange | undefined;
  let nextProbe = 0, recoverAt = now() + 60000, probing = false;
  const device = new MusicCastClient(record.receiver, peerDeviceFetch(() => active && !closed && !remote && !probing && now() >= recoverAt, fetcher));
  const coordinator = () => new CompanionCoordinator(device, peerRandomHex(random, 16));
  let local = coordinator();
  let nextPoll = 0;
  const exchange: CompanionExchange = async request => {
    if (!active || closed) throw new Error('Inactive');
    // CompanionController waits for its observation before a command, so this
    // transition cannot race a local menu operation or command.
    if (!request && !remote && now() >= nextProbe) {
      nextProbe = now() + 5000; probing = true;
      try {
        for (const url of [...new Set([record.url, ...urls()])].slice(0, 5)) {
          try {
            const candidate = await connectPeer({ ...record, url }, random, fetcher);
            if (!active || closed) throw new Error('Inactive');
            // A failed yield response is uncertain: stop local writes, wait, and
            // require an explicit Refresh because the phone may have written meanwhile.
            recoverAt = now() + 60000; local.invalidate();
            const observed = await candidate();
            remote = candidate; return observed;
          } catch { if (!active || closed) throw new Error('Inactive'); }
        }
      } finally { probing = false; }
    }
    if (remote) {
      const current = remote;
      // The phone lease is 12s but a menu action may take far longer. Observation-only
      // heartbeats keep it alive; they carry no operation, so nothing is replayed.
      const heartbeat = request ? setInterval(() => { if (remote === current && active && !closed) void current().catch(() => {}); }, 4000) : undefined;
      try { return await current(request); }
      catch {
        if (remote === current) { remote = undefined; local = coordinator(); recoverAt = now() + 60000; }
        // Never forward a failed remote operation into the local coordinator.
        throw new Error('Peer disconnected. Refresh first.');
      } finally { if (heartbeat) clearInterval(heartbeat); }
    }
    if (request && request.operation.type !== 'observe' && now() < recoverAt) return { sequence: request.sequence, outcome: 'rejected', code: 'reconcile', state: { ...local.state, freshness: 'stale', needsReconcile: true } };
    if (!request) { if (now() >= nextPoll) { nextPoll = now() + 2000; await local.poll(); } return { sequence: local.lastSequence('frame'), outcome: 'observed', state: local.state }; }
    return local.handle('frame', request);
  };
  const controller = new CompanionController(record.receiver, exchange);
  return Object.assign(controller, {
    setActive(value: boolean) { active = value; CompanionController.prototype.setActive.call(controller, value); if (!value) { remote = undefined; recoverAt = now() + 60000; local = coordinator(); } },
    close() { closed = true; active = false; CompanionController.prototype.setActive.call(controller, false); },
  });
}
