const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DeviceSession } = require('../dist');
const host = '192.168.1.50';
const snapshot = { model: 'Example', status: { power: 'standby', input: 'cd' }, features: { controls: ['power'], sources: [], connectivity: [] }, trackUnavailable: false };
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

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
