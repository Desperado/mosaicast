const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BrowseError, DeviceSession } = require('../dist');
const host = '192.168.1.50';
const snapshot = { model: 'Example', status: { power: 'standby', input: 'cd' }, features: { controls: ['power'], sources: [], connectivity: [] }, trackUnavailable: false };
function deferred() { return Promise.withResolvers(); }

test('creating a session and disconnecting never creates a device client', () => {
  let created = 0;
  const session = new DeviceSession(() => { created++; });
  session.disconnect();
  assert.equal(created, 0);
});

test('missing browser bridge has an actionable error while device failures stay distinct', async () => {
  const error = new Error('offline');
  error.name = 'BridgeUnavailableError';
  let fail = true;
  const session = new DeviceSession(() => ({ read: async () => { if (fail) throw error; return snapshot; } }));
  assert.equal(await session.connect(host), false);
  assert.equal(session.state.error, 'bridgeError');
  fail = false; await session.connect(host);
  fail = true; await session.refresh();
  assert.equal(session.state.error, 'bridgeError');
  assert.equal(session.state.phase, 'stale');
  error.name = 'Error'; await session.connect(host);
  assert.equal(session.state.error, 'connectError');
});

test('connect performs only reads; a late connect response cannot revive a disconnected session', async () => {
  const gate = deferred();
  let writes = 0;
  const session = new DeviceSession(() => ({ read: () => gate.promise, execute: () => { writes++; } }));
  const pending = session.connect(host);
  assert.equal(session.state.phase, 'connecting');
  session.disconnect();
  gate.resolve(snapshot);
  assert.equal(await pending, false);
  assert.equal(session.state.phase, 'disconnected');
  assert.equal(session.state.snapshot, undefined);
  assert.equal(writes, 0);
});

test('uncertain commands lock further writes until an explicit successful refresh', async () => {
  let reads = 0, writes = 0, failRead = false;
  const session = new DeviceSession(() => ({
    read: async () => { reads++; if (failRead) throw new Error('offline'); return snapshot; },
    execute: async () => { writes++; throw new Error('timeout after dispatch'); },
  }));
  assert.equal(await session.connect(host), true);
  await session.execute({ type: 'power', value: 'on' });
  assert.equal(session.state.needsRefresh, true);
  assert.equal(session.state.snapshot.status.power, 'standby');
  await session.execute({ type: 'power', value: 'on' });
  await session.refresh(false);
  assert.equal(writes, 1);
  assert.equal(reads, 1);
  failRead = true;
  await session.refresh();
  assert.equal(session.state.error, 'uncertainError');
  assert.equal(session.state.needsRefresh, true);
  failRead = false;
  await session.refresh();
  assert.equal(session.state.needsRefresh, false);
  assert.equal(session.state.phase, 'connected');
  await session.execute({ type: 'power', value: 'on' });
  assert.equal(writes, 2);
});

test('Refresh cannot overlap a pending write or erase its uncertain result', async () => {
  const gate = deferred();
  let reads = 0;
  const session = new DeviceSession(() => ({
    read: async () => { reads++; return snapshot; },
    execute: () => gate.promise,
  }));
  await session.connect(host);
  const command = { type: 'volume', value: 'up' };
  const pending = session.execute(command);
  assert.deepEqual(session.state.pendingCommand, command);
  await session.refresh();
  await session.refresh(false);
  assert.equal(reads, 1);
  assert.equal(session.state.busy, true);
  gate.reject(new Error('timeout after dispatch'));
  await pending;
  assert.equal(session.state.pendingCommand, undefined);
  assert.equal(session.state.error, 'uncertainError');
  assert.equal(session.state.needsRefresh, true);
  await session.refresh(false);
  assert.equal(reads, 1);
  await session.refresh();
  assert.equal(reads, 2);
  assert.equal(session.state.needsRefresh, false);
  assert.equal(session.state.refreshing, false);
});

test('poll reads and commands cannot overlap; stale state cannot issue commands', async () => {
  let writes = 0, fail = false;
  const gate = deferred();
  let calls = 0;
  const session = new DeviceSession(() => ({
    read: async () => { if (fail) throw new Error('offline'); return ++calls === 1 ? snapshot : gate.promise; },
    execute: async () => { writes++; return snapshot; },
  }));
  await session.connect(host);
  const polling = session.refresh(false);
  await session.execute({ type: 'power', value: 'on' });
  assert.equal(writes, 0);
  gate.resolve(snapshot); await polling;
  fail = true; await session.refresh();
  assert.equal(session.state.phase, 'stale');
  await session.execute({ type: 'power', value: 'on' });
  assert.equal(writes, 0);
});

test('late commands from an old device cannot overwrite the new connection; skips are only accepted', async () => {
  const gate = deferred();
  const replacement = { ...snapshot, model: 'Other' };
  const session = new DeviceSession(address => ({ read: async () => address === host ? snapshot : replacement, execute: () => address === host ? gate.promise : Promise.resolve(replacement) }));
  await session.connect(host);
  const pending = session.execute({ type: 'power', value: 'on' });
  session.disconnect();
  await session.connect('192.168.1.51');
  gate.resolve({ ...snapshot, status: { power: 'on', input: 'cd' } });
  await pending;
  assert.equal(session.state.snapshot.model, 'Other');
  await session.execute({ type: 'playback', value: 'next' });
  assert.equal(session.state.outcome, 'accepted');
});

test('uncertain browse actions block all writes and browsing until explicit status refresh; no action is replayed', async () => {
  let actions = 0, browses = 0;
  const page = { input: 'deezer', token: '1', layer: 0, title: 'Library', index: 0, total: 0, items: [] };
  const session = new DeviceSession(() => ({
    read: async () => snapshot,
    browse: async () => { browses++; return page; },
    browseAction: async () => { actions++; throw new BrowseError('uncertainError'); },
    execute: async () => { throw new Error('Must be blocked'); },
  }));
  await session.connect(host);
  await session.loadBrowse('deezer');
  await session.browseAction({ type: 'play', token: '1', index: 0 });
  assert.equal(session.state.browse, undefined);
  assert.equal(session.state.needsRefresh, true);
  await session.loadBrowse('deezer');
  await session.browseAction({ type: 'play', token: '1', index: 0 });
  await session.execute({ type: 'power', value: 'on' });
  await session.refresh(false);
  assert.equal(actions, 1);
  assert.equal(browses, 1);
  assert.equal(session.state.needsRefresh, true);
  await session.refresh();
  assert.equal(session.state.browseError, undefined);
  assert.equal(session.state.needsRefresh, false);
  await session.loadBrowse('deezer');
  assert.equal(browses, 2);
});

test('shared menu changes require a menu refresh without marking device status uncertain', async () => {
  const session = new DeviceSession(() => ({ read: async () => snapshot, browseAction: async () => { throw new BrowseError('browseChanged'); } }));
  await session.connect(host);
  await session.browseAction({ type: 'play', token: '1', index: 0 });
  assert.equal(session.state.browseError, 'browseChanged');
  assert.equal(session.state.needsRefresh, false);
  assert.equal(session.state.phase, 'connected');
});

test('late browse results and errors cannot revive a disconnected session or replace a new room', async () => {
  for (const action of [false, true]) for (const fails of [false, true]) {
    const gate = deferred();
    const session = new DeviceSession(() => ({ read: async () => snapshot, browse: () => gate.promise, browseAction: () => gate.promise }));
    await session.connect(host);
    const pending = action ? session.browseAction({ type: 'back', token: '1' }) : session.loadBrowse('deezer');
    session.disconnect();
    await session.connect('192.168.1.51');
    if (fails) gate.reject(new BrowseError('uncertainError'));
    else gate.resolve(action ? { page: { title: 'Old' } } : { title: 'Old' });
    await pending;
    assert.equal(session.state.host, '192.168.1.51');
    assert.equal(session.state.browse, undefined);
    assert.equal(session.state.browseError, undefined);
    assert.equal(session.state.needsRefresh, false);
    assert.equal(session.state.busy, false);
  }
});

test('menu refresh keeps the displayed page stable while pending and invalidates it on failure', async () => {
  let gate;
  const page = { input: 'deezer', token: '1', title: 'Library', items: [] };
  const session = new DeviceSession(() => ({ read: async () => snapshot, browse: async () => gate ? gate.promise : page }));
  await session.connect(host);
  await session.loadBrowse('deezer');
  gate = deferred();
  const pending = session.loadBrowse('deezer');
  assert.equal(session.state.busy, true);
  assert.deepEqual(session.state.browse, page);
  gate.resolve({ ...page, token: '2' });
  await pending;
  assert.equal(session.state.browse.token, '2');
  gate = deferred();
  const failed = session.loadBrowse('deezer');
  assert.equal(session.state.browse.token, '2');
  gate.reject(new Error('offline'));
  await failed;
  assert.equal(session.state.browse, undefined);
  assert.equal(session.state.browseError, 'browseReadError');
});


test('replacing, disconnecting and failed or late connects close their native resources', async () => {
  const closed = [], gate = deferred();
  const session = new DeviceSession(value => ({close: () => closed.push(value), read: async () => {
    if (value === 'late') return gate.promise;
    if (value === 'failed') throw new Error('Unavailable');
    return snapshot;
  }}));
  await session.connect(host); await session.connect('replacement');
  assert.deepEqual(closed, [host]); session.disconnect();
  assert.deepEqual(closed, [host, 'replacement']);
  assert.equal(await session.connect('failed'), false);
  const pending = session.connect('late'); session.disconnect(); gate.resolve(snapshot);
  assert.equal(await pending, false);
  assert.deepEqual(closed, [host, 'replacement', 'failed', 'late']);
});
