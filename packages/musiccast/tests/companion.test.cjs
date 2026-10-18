const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CompanionCoordinator, CompanionController, CompanionError, CommandRejectedError, BrowseError, DeviceSession, validCompanionRequest } = require('../dist');
const host = '192.168.1.50';
const volume = { type: 'volume', value: 'up' };
function fixture() {
  let value = 10, writes = 0, menuWrites = 0, reads = 0, failWrite = false, failRead = false, gate;
  const snapshot = () => ({ model: 'Fixture', features: { controls: ['power', 'volume'], sources: [], connectivity: [], volumeRange: { min: 0, max: 30, step: 1 } }, status: { power: 'on', input: 'deezer', volume: value }, trackUnavailable: false });
  let revision = 0;
  const page = () => ({ input: 'deezer', token: String(++revision), layer: 0, title: 'Fixture menu', index: 0, total: 1, items: [{ index: 0, text: 'Fixture song', playable: true, selectable: false, searchable: false }] });
  const adapter = {
    read: async () => { reads++; if (failRead) throw new Error('offline'); return snapshot(); },
    execute: async () => { writes++; value++; if (gate) await gate.promise; if (failWrite) throw new Error('uncertain'); return snapshot(); },
    browse: async () => { if (gate) await gate.promise; return page(); },
    browseAction: async () => { menuWrites++; return { page: page() }; },
  };
  let coordinator = new CompanionCoordinator(adapter, 'generation-one');
  const exchange = client => request => request ? coordinator.handle(client, request) : Promise.resolve({ sequence: coordinator.lastSequence(client), outcome: 'observed', state: coordinator.state });
  return { adapter, get coordinator() { return coordinator; }, exchange, client: id => new CompanionController(host, exchange(id)),
    get writes() { return writes; }, get menuWrites() { return menuWrites; }, get reads() { return reads; },
    set failWrite(v) { failWrite = v; }, set failRead(v) { failRead = v; }, set gate(v) { gate = v; },
    externalVolume(v) { value = v; }, restart() { coordinator = new CompanionCoordinator(adapter, 'generation-two'); } };
}
const request = (sequence, operation, generation = 'generation-one') => ({ version: 1, generation, sequence, operation });

test('two clients share receiver volume and external changes without echo writes; closing one does not stop the other', async () => {
  const f = fixture(), phone = f.client('phone'), tv = f.client('tv');
  await f.coordinator.poll(); await phone.read(); await tv.read();
  assert.equal(f.coordinator.state.needsReconcile, true, 'startup cannot forget an interrupted write');
  await phone.reconcile();
  await phone.execute(volume); await tv.read();
  assert.equal(tv.state.snapshot.status.volume, 11); assert.equal(f.writes, 1);
  f.externalVolume(22); await f.coordinator.poll(); await Promise.all([phone.read(), tv.read()]);
  assert.equal(phone.state.snapshot.status.volume, 22); assert.equal(f.writes, 1);
  // Disposing a frontend does not dispose the independent coordinator.
  await tv.execute(volume); assert.equal(f.writes, 2);
  assert.equal(tv.state.snapshot.status.volume, 23);
});

test('duplicates are bounded and never dispatch twice, including in-flight writes and conflicting reused IDs', async () => {
  const f = fixture(); await f.coordinator.handle('phone', request(1, { type: 'reconcile' }));
  const gate = Promise.withResolvers(); f.gate = gate;
  const op = request(2, { type: 'command', command: volume });
  const a = f.coordinator.handle('phone', op), b = f.coordinator.handle('phone', op);
  const conflict = await f.coordinator.handle('phone', request(2, { type: 'command', command: { type: 'power', value: 'on' } }));
  assert.equal(conflict.code, 'sequence'); gate.resolve(); await Promise.all([a, b]); assert.equal(f.writes, 1);
  for (let i = 3; i <= 70; i++) await f.coordinator.handle('phone', request(i, { type: 'release' }));
  assert.equal((await f.coordinator.handle('phone', op)).code, 'sequence'); assert.equal(f.writes, 1);
  assert.equal((await f.coordinator.handle('phone', request(71, { type: 'command', command: volume }, 'old'))).code, 'generation');
});

test('a long menu keeps observations available and sheds all concurrent writes without a queue', async () => {
  const f = fixture(), phone = f.client('phone'), tv = f.client('tv'); await f.coordinator.poll(); await phone.reconcile(); await tv.read();
  const gate = Promise.withResolvers(); f.gate = gate;
  const menu = phone.browse('deezer'); await new Promise(resolve => setImmediate(resolve));
  await tv.read(); assert.equal(tv.state.activity, 'menu');
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => tv.execute(volume)));
  assert.ok(results.every(r => r.status === 'rejected' && r.reason.code === 'busy'));
  assert.equal(f.writes, 0); gate.resolve(); await menu; f.gate = undefined;
  await tv.execute(volume); assert.equal(f.writes, 1);
});

test('menu ownership requires explicit takeover and invalidates old leases and expired actions', async () => {
  const f = fixture(); let time = 0;
  const c = new CompanionCoordinator(f.adapter, 'generation-one', () => time);
  await c.handle('phone', request(1, { type: 'reconcile' }));
  const a = await c.handle('phone', request(2, { type: 'browse', input: 'deezer', index: 0 }));
  assert.equal((await c.handle('tv', request(1, { type: 'browse', input: 'deezer', index: 0 }))).code, 'owned');
  const b = await c.handle('tv', request(2, { type: 'browse', input: 'deezer', index: 0, takeover: true }));
  assert.equal((await c.handle('phone', request(3, { type: 'browseAction', lease: a.lease, action: { type: 'play', token: a.page.token, index: 0 } }))).code, 'browseChanged');
  time = 45001;
  assert.equal((await c.handle('tv', request(3, { type: 'browseAction', lease: b.lease, action: { type: 'play', token: b.page.token, index: 0 } }))).code, 'browseChanged');
  assert.equal(f.menuWrites, 0);
});

test('lost write replies remain uncertain through passive polling; only explicit successful reconcile unlocks', async () => {
  const f = fixture(); let lose = true;
  const phone = new CompanionController(host, async req => {
    const result = await f.exchange('phone')(req);
    if (req?.operation.type === 'command' && lose) { lose = false; throw new Error('lost response'); }
    return result;
  });
  await f.coordinator.poll(); await phone.reconcile();
  await assert.rejects(phone.execute(volume), e => e instanceof CompanionError && e.code === 'uncertain');
  await f.coordinator.poll(); await phone.read();
  await assert.rejects(phone.execute(volume), e => e.code === 'reconcile'); assert.equal(f.writes, 1);
  f.failRead = true; await assert.rejects(phone.reconcile());
  f.failRead = false; await phone.reconcile(); await phone.execute(volume); assert.equal(f.writes, 2);
  f.failWrite = true; await assert.rejects(phone.execute(volume), e => e.code === 'uncertain');
  await f.coordinator.poll(); assert.equal(f.coordinator.state.needsReconcile, true);
  assert.equal((await f.coordinator.handle('tv', request(1, { type: 'command', command: volume }))).code, 'reconcile');
});

test('restart changes the generation and rejects stale requests without replaying them', async () => {
  const f = fixture(), phone = f.client('phone'); await f.coordinator.poll(); await phone.reconcile();
  await phone.execute(volume); f.restart(); await f.coordinator.poll(); await phone.read();
  await assert.rejects(phone.execute(volume), e => e.code === 'reconcile');
  assert.equal(f.writes, 1); await phone.reconcile(); await phone.execute(volume); assert.equal(f.writes, 2);
});

test('session watches are read-only, retain last useful state, and reject-before-dispatch does not latch uncertainty', async () => {
  const f = fixture(), phone = f.client('phone'); await f.coordinator.poll(); await phone.reconcile();
  const session = new DeviceSession(() => phone); await session.connect(host);
  try {
    f.externalVolume(17); await f.coordinator.poll(); await phone.observe();
    assert.equal(session.state.snapshot.status.volume, 17); assert.equal(f.writes, 0);
    f.adapter.execute = async () => { throw new CommandRejectedError(); };
    await session.execute(volume); assert.equal(session.state.needsRefresh, false); assert.equal(session.state.error, 'commandRejected');
    f.failRead = true; await f.coordinator.poll(); await phone.observe();
    assert.equal(session.state.snapshot.status.volume, 17); assert.equal(session.state.phase, 'stale');
  } finally { session.disconnect(); }
});

test('stale external menu guards reject without a write or an uncertainty latch', async () => {
  const f = fixture(), phone = f.client('phone'); await f.coordinator.poll(); await phone.reconcile();
  const page = await phone.browse('deezer');
  f.adapter.browseAction = async () => { throw new BrowseError('browseChanged'); };
  await assert.rejects(phone.browseAction({ type: 'play', token: page.token, index: 0 }), e => e.code === 'browseChanged');
  assert.equal(f.coordinator.state.needsReconcile, false); assert.equal(f.menuWrites, 0);
});

test('transport and operations reject arbitrary targets, raw routes and malformed commands', () => {
  for (const operation of [{ type: 'request', route: 'main/setVolume' }, { type: 'command', command: { type: 'volume', value: 99 } }, { type: 'browse', input: 'arbitrary', index: 0 }, { type: 'browseAction', lease: '1', action: { type: 'play', token: '1', index: -1 } }]) assert.equal(validCompanionRequest(request(1, operation)), false);
});


test('an observation discovering a new generation blocks an already requested write until explicit reconcile', async () => {
  const f = fixture(); const gate = Promise.withResolvers(); let delay = false;
  const client = new CompanionController(host, async request => {
    if (!request && delay) await gate.promise;
    return f.exchange('phone')(request);
  });
  await f.coordinator.poll(); await client.reconcile();
  f.restart(); await f.coordinator.poll(); delay = true;
  const observation = client.observe();
  const write = client.execute(volume);
  gate.resolve(); await observation;
  await assert.rejects(write, error => error.code === 'reconcile');
  assert.equal(f.writes, 0); await client.reconcile(); await client.execute(volume); assert.equal(f.writes, 1);
});


test('first TV Refresh waits for an in-flight phone poll without queueing Yamaha writes', async () => {
  const f = fixture(), tv = f.client('tv');
  const gate = Promise.withResolvers(), read = f.adapter.read;
  let active = 0, overlap = false;
  f.adapter.read = async () => {
    if (++active > 1) overlap = true;
    await gate.promise;
    try { return await read(); } finally { active--; }
  };
  const poll = f.coordinator.poll();
  const refresh = tv.reconcile();
  assert.equal((await f.coordinator.handle('phone', request(1, { type: 'command', command: volume }))).code, 'busy');
  gate.resolve(); await poll;
  assert.equal((await refresh).status.volume, 10);
  assert.equal(tv.state.needsReconcile, false);
  assert.equal(overlap, false); assert.equal(f.writes, 0);
});

test('opening Deezer waits for a background status read while writes still reject as busy', async () => {
  const f = fixture(), phone = f.client('phone'), tv = f.client('tv');
  await phone.reconcile(); await tv.read();
  const gate = Promise.withResolvers(), read = f.adapter.read, browse = f.adapter.browse;
  let reading = false, overlap = false, menus = 0;
  f.adapter.read = async () => {
    reading = true; await gate.promise;
    try { return await read(); } finally { reading = false; }
  };
  f.adapter.browse = async (...args) => {
    overlap ||= reading; menus++; return browse(...args);
  };
  const poll = f.coordinator.poll();
  const menu = phone.browse('deezer');
  // Attach a handler before yielding: the old implementation rejects immediately.
  const result = Promise.allSettled([menu]);
  await assert.rejects(tv.execute(volume), error => error.code === 'busy');
  assert.equal(menus, 0);
  gate.resolve(); await poll;
  const [opened] = await result;
  assert.equal(opened.status, 'fulfilled');
  assert.equal(opened.value.input, 'deezer');
  assert.equal(overlap, false); assert.equal(menus, 1); assert.equal(f.writes, 0);
});

test('a menu waiting for a poll still respects ownership and failed status reads', async () => {
  const f = fixture(), phone = f.client('phone'), tv = f.client('tv');
  await phone.reconcile(); await tv.read(); await tv.browse('deezer');
  const read = f.adapter.read;
  let gate = Promise.withResolvers();
  f.adapter.read = async () => { await gate.promise; return read(); };
  let poll = f.coordinator.poll();
  let menu = assert.rejects(phone.browse('deezer'), error => error.code === 'companionOwned');
  gate.resolve(); await poll; await menu;
  assert.equal(f.coordinator.state.menuOwner, 'tv');
  gate = Promise.withResolvers(); f.failRead = true;
  poll = f.coordinator.poll();
  menu = assert.rejects(phone.browse('deezer', 0, true), error => error.code === 'reconcile');
  gate.resolve(); await poll; await menu;
  assert.equal(f.coordinator.state.menuOwner, 'tv');
  assert.equal(f.menuWrites, 0); assert.equal(f.writes, 0);
});

test('shared pairing refresh clears on both apps and does not claim an unknown command result', async () => {
  const f = fixture(), phone = f.client('phone'), tv = f.client('tv');
  await f.coordinator.poll(); await phone.reconcile();
  const session = new DeviceSession(() => phone); await session.connect(host);
  try {
    f.coordinator.invalidate(); await phone.observe();
    assert.equal(session.state.needsRefresh, true);
    assert.equal(session.state.error, 'refreshRequired');
    await tv.reconcile(); await phone.observe();
    assert.equal(session.state.needsRefresh, false);
    assert.equal(session.state.error, undefined);
    await session.execute(volume); assert.equal(f.writes, 1);
  } finally { session.disconnect(); }
});

test('a remote Refresh cannot clear a phone command whose reply was lost', async () => {
  const f = fixture(), tv = f.client('tv'); let lose = true;
  const phone = new CompanionController(host, async req => {
    const reply = await f.exchange('phone')(req);
    if (req?.operation.type === 'command' && lose) { lose = false; throw new Error('lost reply'); }
    return reply;
  });
  await f.coordinator.poll(); await phone.reconcile();
  const session = new DeviceSession(() => phone); await session.connect(host);
  try {
    await session.execute(volume);
    await tv.reconcile(); await phone.observe();
    assert.equal(session.state.needsRefresh, true);
    assert.equal(session.state.error, 'uncertainError');
    await session.execute(volume); assert.equal(f.writes, 1);
    await session.refresh(); await session.execute(volume); assert.equal(f.writes, 2);
  } finally { session.disconnect(); }
});

test('a successful cached observation clears a watch transport error without a new revision', async t => {
  const f = fixture(); let offline = false;
  const tv = new CompanionController(host, request => {
    if (offline) return Promise.reject(new Error('connection interrupted'));
    return f.exchange('tv')(request);
  });
  await f.coordinator.poll(); await tv.reconcile();
  const revision = tv.state.revision, observed = [];
  t.mock.timers.enable({ apis: ['setInterval'] });
  const stop = tv.watch(state => observed.push(state));
  try {
    offline = true; t.mock.timers.tick(500);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(observed.at(-1).stale, true);
    assert.equal(observed.at(-1).needsRefresh, false);
    offline = false; t.mock.timers.tick(500);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(tv.state.revision, revision);
    assert.equal(observed.at(-1).stale, false);
    assert.equal(observed.at(-1).needsRefresh, false);
    assert.equal(f.writes, 0);
  } finally { stop(); }
});

test('a phone Refresh after coordinator restart also unlocks an observing TV', async () => {
  const f = fixture(), tv = f.client('tv');
  await f.coordinator.poll(); await tv.reconcile();
  f.restart(); await f.coordinator.poll(); await tv.observe();
  await assert.rejects(tv.execute(volume), error => error.code === 'reconcile');
  assert.equal(f.writes, 0);
  await f.client('phone').reconcile(); await tv.observe();
  const observed = []; const stop = tv.watch(state => observed.push(state));
  try {
    assert.equal(observed.at(-1).needsRefresh, false);
    await tv.execute(volume); assert.equal(f.writes, 1);
  } finally { stop(); }
});

test('a coordinator restart and phone Refresh cannot clear the TV own lost write reply', async () => {
  const f = fixture();
  const tv = new CompanionController(host, async request => {
    const reply = await f.exchange('tv')(request);
    if (request?.operation.type === 'command') throw new Error('lost reply');
    return reply;
  });
  await f.coordinator.poll(); await tv.reconcile();
  await assert.rejects(tv.execute(volume), error => error.code === 'uncertain');
  f.restart(); await f.coordinator.poll(); await tv.observe();
  await f.client('phone').reconcile(); await tv.observe();
  await assert.rejects(tv.execute(volume), error => error.code === 'reconcile');
  assert.equal(f.writes, 1);
  await tv.reconcile();
});

test('shared menu pages follow navigation on the other screen without granting its write lease', async () => {
  const f = fixture(), phone = f.client('phone'), tv = f.client('tv');
  const session = new DeviceSession(() => phone);
  try {
    await phone.reconcile(); await session.connect(host);
    await session.loadBrowse('deezer');
    const first = session.state.browse;
    const remote = await tv.browse('deezer', 0, true);
    const navigated = (await tv.browseAction({ type: 'select', token: remote.token, index: 0 })).page;
    await phone.observe();
    assert.deepEqual(session.state.browse, navigated);
    assert.notEqual(session.state.browse.token, first.token);
    await session.loadBrowse('deezer');
    assert.equal(session.state.browseError, 'companionOwned');
    assert.deepEqual(session.state.browse, navigated, 'a rejected ownership request keeps the shared read-only page');
    const menuWrites = f.menuWrites;
    await session.browseAction({ type: 'play', token: navigated.token, index: 0 });
    assert.equal(session.state.browseError, 'browseChanged');
    assert.equal(f.menuWrites, menuWrites, 'observing a page cannot transfer menu ownership');
    await session.loadBrowse('deezer', 0, true);
    await session.browseAction({ type: 'play', token: session.state.browse.token, index: 0 });
    assert.equal(f.menuWrites, menuWrites + 1);
    await tv.observe();
    assert.deepEqual(tv.state.menu, session.state.browse);
    await phone.releaseBrowse();
    assert.equal(session.state.browse, undefined);
    await tv.observe(); assert.equal(tv.state.menu, undefined);
  } finally { session.disconnect(); }
});
