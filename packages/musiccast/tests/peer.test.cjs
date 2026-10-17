const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { CompanionCoordinator, CompanionController, PhonePeerService, createPeerInvitation, readPeerInvitation, beginQRPairing, beginPeerPairing, connectPeer, createTVPeerController, peerDeviceFetch, MusicCastClient } = require('../dist');
const { peerCommit, peerKeyPair, openPeer } = require('../dist/peer-crypto');
const random = n => new Uint8Array(randomBytes(n));
const receiver = '192.168.1.20', url = 'http://192.168.1.10:8095';
const volume = { type: 'volume', value: 'up' };
function fixture() {
  let time = 1000, writes = 0, value = 10, failPersist = false, persistCount = 0, persisted, online = true, gate;
  const snapshot = () => ({ model: 'Fixture', features: { controls: ['volume'], sources: [], connectivity: [], volumeRange: { min: 0, max: 30, step: 1 } }, status: { power: 'on', input: 'cd', volume: value }, trackUnavailable: false });
  const adapter = { read: async () => { if (gate) await gate.promise; return snapshot(); }, execute: async () => { writes++; value++; return snapshot(); } };
  const coordinator = new CompanionCoordinator(adapter, 'phone-generation');
  const service = new PhonePeerService(receiver, url, coordinator, random, undefined, async record => { persistCount++; if (failPersist) throw new Error('storage'); persisted = record; }, () => time);
  const packets = [];
  const fetcher = async (address, options = {}) => {
    if (!online) throw new Error('offline');
    const path = new URL(address).pathname, body = options.body ? JSON.parse(options.body) : undefined;
    packets.push({ path, body });
    const result = await service.handle(options.method ?? 'GET', path, body);
    return { ok: true, text: async () => JSON.stringify(result) };
  };
  return { service, coordinator, adapter, fetcher, packets, snapshot, get writes() { return writes; }, get persisted() { return persisted; }, get persistCount() { return persistCount; }, set failPersist(v) { failPersist = v; }, set online(v) { online = v; }, set gate(v) { gate = v; }, advance(n) { time += n; }, now: () => time };
}
async function paired(f) { const pairing = await beginPeerPairing(url, random, f.fetcher); assert.ok(pairing.comparison === f.service.pairing.comparison); f.service.approve(); return pairing.confirm(); }

test('pairing requires matching comparison and approval on phone, and secure persistence', async () => {
  const f = fixture();
  const pending = await beginPeerPairing(url, random, f.fetcher);
  assert.match(pending.comparison, /^\d{6}$/);
  assert.ok(pending.comparison === f.service.pairing.comparison);
  await assert.rejects(pending.confirm(), /approved/); assert.equal(f.persisted, undefined);
  f.service.approve(); f.failPersist = true;
  await assert.rejects(pending.confirm(), /storage/); assert.equal(f.service.paired, false);
  f.failPersist = false; const record = await pending.confirm();
  assert.equal(f.service.paired, true); assert.ok(record.key === f.persisted.key);
  assert.equal(f.service.waitingForTV, true); assert.equal(f.writes, 0);
  assert.ok(f.packets.every(p => !p.body || !Object.hasOwn(p.body, 'key')));
});

test('pair commitment substitution, expiry and overlapping attempts are rejected', async () => {
  const f = fixture(), a = peerKeyPair(random), b = peerKeyPair(random);
  const start = await f.service.handle('POST', '/peer/pair/start', { commit: peerCommit(a.publicKey, a.nonce) });
  await assert.rejects(f.service.handle('POST', '/peer/pair/reveal', { id: start.id, publicKey: b.publicKey, nonce: b.nonce }));
  await assert.rejects(beginPeerPairing(url, random, f.fetcher), /busy/);
  await f.service.handle('POST', '/peer/pair/reveal', { id: start.id, publicKey: a.publicKey, nonce: a.nonce });
  f.advance(120001); assert.equal(f.service.pairing, undefined); assert.throws(() => f.service.approve(), /expired/);
  const pending = await beginPeerPairing(url, random, f.fetcher); f.service.approve(); f.advance(120001);
  await assert.rejects(pending.confirm(), /approved/);
});

test('encrypted envelopes bind direction, identity, generation and counter; replay never dispatches again', async () => {
  const f = fixture(), record = await paired(f), exchange = await connectPeer(record, random, f.fetcher);
  await exchange(); const tv = new CompanionController(receiver, exchange); await tv.reconcile(); await tv.execute(volume);
  assert.equal(f.writes, 1);
  const packet = f.packets.filter(p => p.path === '/peer/exchange').at(-1).body;
  assert.ok(!JSON.stringify(packet).includes('volume'));
  for (const altered of [packet, { ...packet, counter: packet.counter + 1 }, { ...packet, epoch: randomBytes(16).toString('hex') }, { ...packet, id: randomBytes(16).toString('hex') }, { ...packet, box: '00' + packet.box.slice(2) }]) {
    await assert.rejects(f.service.handle('POST', '/peer/exchange', altered));
  }
  assert.throws(() => openPeer(record.key, packet, 'response')); assert.equal(f.writes, 1);
  const sessionPacket = f.packets.find(p => p.path === '/peer/session').body;
  await assert.rejects(f.service.handle('POST', '/peer/session', sessionPacket));
  const reboot = new PhonePeerService(receiver, url, f.coordinator, random, record, async () => {}, f.now);
  await assert.rejects(reboot.handle('POST', '/peer/session', sessionPacket));
});

test('phone waits for TV yield, then both clients share one write lock and need explicit Refresh', async () => {
  const f = fixture(), record = await paired(f), phone = new CompanionController(receiver, f.service.localExchange);
  await f.coordinator.poll(); await assert.rejects(phone.reconcile(), e => e.code === 'offline');
  const exchange = await connectPeer(record, random, f.fetcher); await exchange();
  assert.equal(f.service.canControl, true); assert.equal(f.coordinator.state.needsReconcile, true);
  await assert.rejects(phone.execute(volume), e => e.code === 'reconcile');
  await phone.reconcile(); await phone.execute(volume); assert.equal(f.writes, 1);
  const tv = new CompanionController(receiver, exchange); await tv.read();
  const gate = Promise.withResolvers(); f.adapter.execute = async () => { await gate.promise; return f.snapshot(); };
  const command = phone.execute(volume); await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(tv.execute(volume), e => e.code === 'busy'); gate.resolve(); await command;
});

test('expired phone authority cannot be renewed by a late heartbeat and fences delayed Yamaha writes', async () => {
  const f = fixture(), record = await paired(f), remote = await connectPeer(record, random, f.fetcher); await remote();
  await new CompanionController(receiver, f.service.localExchange).reconcile();
  const gate = Promise.withResolvers(); let writes = 0, delay = false;
  const device = new MusicCastClient(receiver, peerDeviceFetch(() => f.service.canControl, async address => {
    const route = new URL(address).pathname.split('/v1/')[1];
    if (route === 'main/getStatus' && delay) await gate.promise;
    if (route.startsWith('main/set')) writes++;
    const data = route === 'system/getFeatures' ? { system: { input_list: [{ id: 'cd', play_info_type: 'none' }], func_list: [] }, zone: [{ id: 'main', func_list: ['volume'], input_list: ['cd'], range_step: [{ id: 'volume', min: 0, max: 30, step: 1 }] }] } : route === 'main/getStatus' ? { power: 'on', input: 'cd', volume: 10 } : { model_name: 'Fixture' };
    return { ok: true, json: async () => ({ response_code: 0, ...data }) };
  }));
  await device.read(); delay = true; const command = device.execute(volume); await new Promise(resolve => setImmediate(resolve));
  f.advance(12001); gate.resolve(); await assert.rejects(command); assert.equal(writes, 0);
  assert.equal(f.service.canControl, false); assert.equal(f.coordinator.state.needsReconcile, true);
  await assert.rejects(remote()); assert.equal(f.service.canControl, false);
  // Includes tuner mutations whose route does not begin with set.
  const fenced = peerDeviceFetch(() => false, async () => { writes++; });
  for (const route of ['main/setVolume', 'tuner/startDabInitialScan', 'tuner/cancelDabInitialScan', 'tuner/recallPreset', 'netusb/setListControl']) await assert.rejects(fenced(`http://${receiver}/YamahaExtendedControl/v1/${route}`));
  assert.equal(writes, 0);
});

test('takeover during a slow reconcile cannot let its late response unlock writes', async () => {
  const f = fixture(); const phone = new CompanionController(receiver, f.service.localExchange);
  await f.coordinator.poll(); const gate = Promise.withResolvers(); f.gate = gate;
  const refresh = phone.reconcile(); await new Promise(resolve => setImmediate(resolve));
  f.service.takeControl(); gate.resolve(); await refresh;
  assert.equal(f.coordinator.state.needsReconcile, true);
  await assert.rejects(phone.execute(volume), e => e.code === 'reconcile'); assert.equal(f.writes, 0);
});

test('lost encrypted write reply is never replayed locally; TV takeover waits then explicitly reads Yamaha', async () => {
  const f = fixture(), record = await paired(f); let lose = true, yamahaWrites = 0, localVolume = 11;
  const fetcher = async (address, options) => {
    if (String(address).includes(':8095/')) {
      const result = await f.fetcher(address, options);
      if (new URL(address).pathname === '/peer/exchange' && f.writes && lose) { lose = false; throw new Error('lost reply'); }
      return result;
    }
    const route = new URL(address).pathname.split('/v1/')[1];
    if (route === 'main/setVolume') { yamahaWrites++; localVolume++; }
    const data = route === 'system/getFeatures' ? { system: { input_list: [{ id: 'cd', play_info_type: 'none' }], func_list: [] }, zone: [{ id: 'main', func_list: ['volume'], input_list: ['cd'], range_step: [{ id: 'volume', min: 0, max: 30, step: 1 }] }] } : route === 'main/getStatus' ? { power: 'on', input: 'cd', volume: localVolume } : { model_name: 'Fixture' };
    return { ok: true, json: async () => ({ response_code: 0, ...data }) };
  };
  const tv = createTVPeerController(record, random, () => [], fetcher, f.now);
  try {
    await tv.read(); await tv.reconcile();
    await assert.rejects(tv.execute(volume), e => e.code === 'uncertain');
    assert.equal(f.writes, 1); assert.equal(yamahaWrites, 0); f.online = false;
    await assert.rejects(tv.reconcile()); f.advance(59999); await assert.rejects(tv.reconcile());
    assert.equal(yamahaWrites, 0); f.advance(2); await tv.read();
    await assert.rejects(tv.execute(volume), e => e.code === 'reconcile');
    await tv.reconcile(); await tv.execute(volume); assert.equal(yamahaWrites, 1);
    // Reopening phone: TV yields and retires local menu/generation before writes.
    f.online = true; f.advance(5001); await tv.read();
    await assert.rejects(tv.execute(volume), e => e.code === 'reconcile'); assert.equal(yamahaWrites, 1);
    await tv.reconcile(); await tv.execute(volume); assert.equal(f.writes, 2);
  } finally { tv.close(); }
});

test('phone-only explicit takeover invalidates state and cannot reuse a prior menu selection', async () => {
  const f = fixture(), record = await paired(f);
  const restarted = new PhonePeerService(receiver, url, f.coordinator, random, record, async () => {}, f.now);
  const phone = new CompanionController(receiver, restarted.localExchange); await f.coordinator.poll();
  await assert.rejects(phone.reconcile()); restarted.takeControl();
  await assert.rejects(phone.execute(volume), e => e.code === 'reconcile'); await phone.reconcile(); await phone.execute(volume);
  assert.equal(f.writes, 1); restarted.close(); await assert.rejects(phone.execute(volume)); assert.equal(f.writes, 1);
});

function localYamaha() {
  const state = { writes: 0, volume: 11 };
  const respond = route => {
    if (route === 'main/setVolume') { state.writes++; state.volume++; }
    const data = route === 'system/getFeatures' ? { system: { input_list: [{ id: 'cd', play_info_type: 'none' }], func_list: [] }, zone: [{ id: 'main', func_list: ['volume'], input_list: ['cd'], range_step: [{ id: 'volume', min: 0, max: 30, step: 1 }] }] } : route === 'main/getStatus' ? { power: 'on', input: 'cd', volume: state.volume } : { model_name: 'Fixture' };
    return { ok: true, json: async () => ({ response_code: 0, ...data }) };
  };
  return { state, respond };
}

test('a lost hand-off reply makes the TV Refresh before its own writes resume', async () => {
  const f = fixture(), record = await paired(f), yamaha = localYamaha(); let loseYield = false;
  const fetcher = async (address, options) => {
    if (!String(address).includes(':8095/')) return yamaha.respond(new URL(address).pathname.split('/v1/')[1]);
    const result = await f.fetcher(address, options);
    if (loseYield && new URL(address).pathname === '/peer/exchange') { loseYield = false; throw new Error('lost reply'); }
    return result;
  };
  f.online = false;
  const tv = createTVPeerController(record, random, () => [], fetcher, f.now);
  try {
    await tv.read(); f.advance(60001); await tv.read(); await tv.reconcile(); await tv.execute(volume);
    assert.equal(yamaha.state.writes, 1);
    // The phone receives the yield, but its reply is lost: the phone may now write.
    f.online = true; loseYield = true; f.advance(5001); await tv.observe();
    assert.equal(f.service.canControl, true); assert.equal(loseYield, false);
    f.online = false; f.advance(60001); await tv.observe();
    await assert.rejects(tv.execute(volume), e => e.code === 'reconcile'); assert.equal(yamaha.state.writes, 1);
    await tv.reconcile(); await tv.execute(volume); assert.equal(yamaha.state.writes, 2);
  } finally { tv.close(); }
});

test('heartbeats keep phone authority during a slow TV menu operation without replaying it', async t => {
  const f = fixture(), record = await paired(f), gate = Promise.withResolvers(); let browses = 0;
  f.adapter.browse = async (input, index) => { browses++; await gate.promise; return { input, token: '', layer: 0, title: 'Deezer', index, total: 0, items: [] }; };
  const tv = createTVPeerController(record, random, () => [], f.fetcher, f.now);
  try {
    await tv.read(); await tv.reconcile(); assert.equal(f.service.canControl, true);
    t.mock.timers.enable({ apis: ['setInterval'] });
    const browse = tv.browse('deezer', 0);
    for (let i = 0; i < 5; i++) {
      f.advance(4000); t.mock.timers.tick(4000);
      for (let j = 0; j < 20; j++) await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(f.service.canControl, true, 'a 20s menu read must not expire the 12s phone lease');
    gate.resolve(); assert.equal((await browse).title, 'Deezer'); assert.equal(browses, 1);
    await tv.observe(); assert.equal(f.service.canControl, true);
    // Heartbeats stop with the operation, so a vanished TV still loses authority.
    f.advance(4000); t.mock.timers.tick(4000); f.advance(8001);
    assert.equal(f.service.canControl, false);
  } finally { t.mock.timers.reset(); tv.close(); }
});


test('QR pairing authenticates the scanned invitation, waits for durable phone save and restores after restart', async () => {
  const f = fixture(), qr = createPeerInvitation(random, receiver, f.now());
  assert.ok(readPeerInvitation(qr.text, f.now()).id === qr.invitation.id);
  // TV and phone clocks may differ slightly even with network time enabled.
  assert.ok(readPeerInvitation(qr.text, f.now() - 30000).id === qr.invitation.id);
  f.service.acceptInvitation(qr.text);
  const descriptor = await f.service.handle('GET', '/.well-known/mosaicast-peer');
  assert.ok(descriptor.invitation === qr.invitation.id);
  assert.equal(Object.hasOwn(descriptor, 'secret'), false);
  assert.equal(JSON.stringify(descriptor).includes(qr.invitation.secret), false);
  const wrong = { ...qr.invitation, secret: randomBytes(32).toString('hex') };
  await assert.rejects(beginQRPairing(url, wrong, random, f.fetcher, f.now()));
  assert.equal(f.service.pairing, undefined);
  const pending = await beginQRPairing(url, qr.invitation, random, f.fetcher, f.now());
  assert.equal(f.service.pairing.qr, true);
  assert.equal(f.service.pairing.comparison, undefined);
  f.failPersist = true;
  await assert.rejects(pending.confirm(), /storage/);
  assert.equal(f.service.paired, false);
  f.failPersist = false;
  const record = await pending.confirm();
  assert.equal(f.service.paired, true);
  assert.ok(record.key === f.persisted.key);
  assert.equal(f.writes, 0);
  f.service.close();
  const restarted = new PhonePeerService(receiver, url, f.coordinator, random, f.persisted, async () => { throw new Error('must not re-pair'); }, f.now);
  const fetcher = async (address, options = {}) => ({ ok: true, text: async () => JSON.stringify(await restarted.handle(options.method ?? 'GET', new URL(address).pathname, options.body ? JSON.parse(options.body) : undefined)) });
  try {
    const exchange = await connectPeer(record, random, fetcher);
    await exchange();
    assert.equal(restarted.canControl, true);
    assert.equal(f.writes, 0);
  } finally { restarted.close(); }
});

test('lost pairing acknowledgement can be requested again without a second save or receiver write', async () => {
  const f = fixture(); let lose = true;
  const fetcher = async (address, options) => {
    const response = await f.fetcher(address, options);
    if (new URL(address).pathname === '/peer/pair/confirm' && lose) { lose = false; throw new Error('lost acknowledgement'); }
    return response;
  };
  const pending = await beginPeerPairing(url, random, fetcher);
  f.service.approve();
  await assert.rejects(pending.confirm(), /lost acknowledgement/);
  assert.equal(f.service.paired, true);
  assert.equal(f.persistCount, 1);
  await pending.confirm();
  assert.equal(f.persistCount, 1);
  assert.equal(f.writes, 0);
});

test('QR validation rejects expired, malformed and public-receiver invitations; expired QR does not block manual pairing', async () => {
  const f = fixture(), qr = createPeerInvitation(random, receiver, f.now());
  const encode = value => 'mosaicast://pair/' + encodeURIComponent(JSON.stringify(value));
  for (const value of [null, {}, { ...qr.invitation, id: null }, { ...qr.invitation, secret: 1 }, { ...qr.invitation, expires: f.now() }, { ...qr.invitation, expires: f.now() + 360001 }, { ...qr.invitation, receiver: '8.8.8.8' }]) assert.throws(() => readPeerInvitation(encode(value), f.now()));
  for (const value of ['', 'https://example.com', 'mosaicast://pair/%', 'mosaicast://pair/' + 'a'.repeat(401)]) assert.throws(() => readPeerInvitation(value, f.now()));
  f.service.acceptInvitation(qr.text);
  await assert.rejects(beginPeerPairing(url, random, f.fetcher), /busy/);
  f.advance(300001);
  await assert.rejects(beginQRPairing(url, qr.invitation, random, f.fetcher, f.now()));
  await beginPeerPairing(url, random, f.fetcher);
  assert.equal(f.writes, 0);
});


test('explicit rescanning after a phone restart can replace a pair with the same invitation ID', async () => {
  const f = fixture(), qr = createPeerInvitation(random, receiver, f.now());
  f.service.acceptInvitation(qr.text);
  const first = await beginQRPairing(url, qr.invitation, random, f.fetcher, f.now());
  const old = await first.confirm(); f.service.close();
  let saved;
  const restarted = new PhonePeerService(receiver, url, f.coordinator, random, old, async record => { saved = record; }, f.now);
  const fetcher = async (address, options = {}) => ({ ok: true, text: async () => JSON.stringify(await restarted.handle(options.method ?? 'GET', new URL(address).pathname, options.body ? JSON.parse(options.body) : undefined)) });
  try {
    restarted.acceptInvitation(qr.text);
    const pending = await beginQRPairing(url, qr.invitation, random, fetcher, f.now());
    const replacement = await pending.confirm();
    assert.ok(replacement.id === old.id && replacement.key !== old.key);
    assert.ok(saved.key === replacement.key);
    assert.equal(restarted.pairing, undefined);
    assert.equal(f.writes, 0);
  } finally { restarted.close(); }
});
