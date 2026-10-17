const { test } = require('node:test');
const assert = require('node:assert/strict');
const { captureVolumeButtons, sendVolumeStep } = require('../src/state/volume-buttons.ts');
const { DeviceSession } = require('../../../packages/musiccast/dist');
const settle = () => new Promise(resolve => setImmediate(resolve));

function phone(original) {
  let volume = original, listener;
  const changes = [], ui = [];
  const output = {
    getVolume: async () => ({ volume }),
    setVolume: async (value, options) => {
      changes.push([value, options.showUI]);
      volume = value;
      listener?.({ volume });
    },
    showNativeVolumeUI: async ({ enabled }) => { ui.push(enabled); },
    addVolumeListener: callback => {
      listener = callback;
      return { remove: () => { listener = undefined; } };
    },
  };
  return { output, changes, ui, press: value => { volume = value; listener?.({ volume }); } };
}

test('both phone-volume endpoints support repeated presses without midpoint or restoration writes', async () => {
  for (const original of [0, 0.5, 1]) {
    const native = phone(original), steps = [];
    const capture = captureVolumeButtons(native.output, step => steps.push(step), () => assert.fail('Unexpected native failure'));
    await capture.ready;
    assert.deepEqual(steps, []);
    native.press(0.5625);
    native.press(0.5625); // Duplicate output notification, not another press.
    await settle();
    native.press(0.5625);
    await settle();
    native.press(0.4375);
    await settle();
    assert.deepEqual(steps, ['up', 'up', 'down']);
    await capture.stop();
    await capture.stop();
    native.press(0.9);
    assert.deepEqual(steps, ['up', 'up', 'down']);
    assert.deepEqual(native.changes.at(-1), [original, true]);
    assert.equal(native.changes.filter(([, showUI]) => showUI).length, 1);
    assert.deepEqual(native.ui, [false, true]);
  }
});

test('leaving while the original volume is loading never captures or changes the phone', async () => {
  const gate = Promise.withResolvers(), native = phone(0.25);
  native.output.getVolume = () => gate.promise;
  const capture = captureVolumeButtons(native.output, () => assert.fail('Late press'), () => assert.fail('Unexpected failure'));
  const stopped = capture.stop();
  gate.resolve({ volume: 0.25 });
  await stopped;
  assert.deepEqual(native.changes, []);
  assert.deepEqual(native.ui, []);
});

test('native capture failures restore the phone and stop forwarding changes', async () => {
  const native = phone(0.25), steps = [];
  let failures = 0;
  const originalSet = native.output.setVolume;
  native.output.setVolume = async (value, options) => {
    if (!options.showUI) throw new Error('Native volume unavailable');
    return originalSet(value, options);
  };
  const capture = captureVolumeButtons(native.output, step => steps.push(step), () => { failures++; });
  await capture.ready;
  await capture.stop();
  native.press(0.75);
  assert.equal(failures, 1);
  assert.deepEqual(steps, []);
  assert.deepEqual(native.changes, [[0.25, true]]);
  assert.deepEqual(native.ui, [false, true]);
});

const snapshot = {
  model: 'Example Yamaha', trackUnavailable: true,
  features: { controls: ['volume'], sources: [], connectivity: [], volumeRange: { min: 0, max: 63, step: 1 } },
  status: { power: 'on', input: 'server', volume: 4, maxVolume: 40 },
};

test('an output route that ignores volume changes restores the system UI and reports capture unavailable', async () => {
  const native = phone(0.25);
  let failures = 0;
  native.output.setVolume = async () => {};
  const capture = captureVolumeButtons(native.output, () => assert.fail('Unexpected write'), () => { failures++; });
  await capture.ready;
  await capture.stop();
  assert.equal(failures, 1);
  assert.deepEqual(native.ui, [false, true]);
});

test('hardware writes respect reported limits, power, capability and current connection state', () => {
  const writes = [];
  const state = { phase: 'connected', busy: false, needsRefresh: false, snapshot: structuredClone(snapshot) };
  const session = { state, execute: async command => { writes.push(command); } };
  sendVolumeStep(session, 'up');
  sendVolumeStep(session, 'down');
  assert.deepEqual(writes, [{ type: 'volume', value: 'up' }, { type: 'volume', value: 'down' }]);
  writes.length = 0;
  state.snapshot.status.volume = 40; sendVolumeStep(session, 'up');
  state.snapshot.status.volume = 0; sendVolumeStep(session, 'down');
  state.snapshot.status.volume = 4;
  for (const patch of [{ phase: 'disconnected' }, { phase: 'stale' }, { busy: true }, { needsRefresh: true }]) {
    sendVolumeStep({ ...session, state: { ...state, ...patch } }, 'up');
  }
  state.snapshot.status.power = 'standby'; sendVolumeStep(session, 'up');
  state.snapshot.status.power = 'on'; state.snapshot.features.controls = []; sendVolumeStep(session, 'up');
  state.snapshot.features.controls = ['volume']; delete state.snapshot.features.volumeRange; sendVolumeStep(session, 'up');
  assert.deepEqual(writes, []);
});

test('presses during a pending or uncertain Yamaha write are never queued or replayed', async () => {
  const gate = Promise.withResolvers();
  let writes = 0;
  const session = new DeviceSession(() => ({
    read: async () => snapshot,
    execute: async () => { writes++; return gate.promise; },
  }));
  await session.connect('192.168.1.40');
  sendVolumeStep(session, 'up');
  sendVolumeStep(session, 'down');
  assert.equal(writes, 1);
  gate.reject(new Error('Timeout after dispatch'));
  await settle();
  sendVolumeStep(session, 'up');
  await session.refresh(false);
  assert.equal(session.state.needsRefresh, true);
  assert.equal(writes, 1);
  await session.refresh();
  assert.equal(writes, 1);
});
