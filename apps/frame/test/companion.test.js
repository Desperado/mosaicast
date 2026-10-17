import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import api from '../../../packages/musiccast/dist/index.js';
import { FrameCompanion, companionTuner, pairFrame, savedCompanion } from '../app/companion.js';

const snapshot = () => ({ model: 'Fixture', features: { controls: ['power', 'volume', 'mute'], connectivity: [], sources: [{ id: 'deezer', name: 'Deezer', networkPlayer: true }, { id: 'tuner', name: 'Radio', networkPlayer: false, tuner: true }], volumeRange: { min: 0, max: 20, step: 1 } }, status: { power: 'on', input: 'deezer', volume: 10, mute: false }, track: { title: 'Fixture song', artist: '', album: '', playback: 'pause' }, trackUnavailable: false });

const random = n => new Uint8Array(randomBytes(n));
const url = 'http://192.168.1.10:8095';
function service(coordinator, record) {
  const phone = new api.PhonePeerService('192.168.1.20', url, coordinator, random, record, async () => {});
  return { phone, fetcher: async (address, options = {}) => {
    const value = await phone.handle(options.method || 'GET', new URL(address).pathname, options.body ? JSON.parse(options.body) : undefined);
    return { ok: true, text: async () => JSON.stringify(value) };
  } };
}

test('TV controls use authenticated semantic operations and never echo observations', async () => {
  let current = snapshot(), writes = 0;
  const coordinator = new api.CompanionCoordinator({ read: async () => current, execute: async command => {
    writes++;
    if (command.type === 'volume') current.status.volume++;
    if (command.type === 'input') current.status.input = command.value;
    return current;
  } }, 'fixture');
  const record = { url, receiver: '192.168.1.20', id: randomBytes(16).toString('hex'), key: randomBytes(32).toString('hex') };
  const { fetcher } = service(coordinator, record), priorFetch = globalThis.fetch;
  globalThis.fetch = fetcher;
  const tv = new FrameCompanion(record);
  try {
    await tv.request('system/getFeatures'); await tv.request('main/getStatus'); assert.equal(writes, 0);
    await assert.rejects(tv.sound('up'), /Refresh/); await tv.reconcile();
    assert.equal((await tv.sound('up')).volume, 11); assert.equal(writes, 1);
    current.status.volume = 17; await coordinator.poll();
    assert.equal((await tv.request('main/getStatus')).volume, 17); assert.equal(writes, 1);
    await assert.rejects(tv.request('main/setVolume', { volume: 99 }), /Unsupported/); assert.equal(writes, 1);
    await tv.selectInput('tuner'); assert.equal(writes, 2);
    await assert.rejects(tv.request('netusb/setPlayback', { playback: 'stop' }), /Use Pause/);
  } finally { tv.close(); globalThis.fetch = priorFetch; }
});

test('TV pairing requires both screens and Key Manager; browser credentials stay in memory', async () => {
  const priorFetch = globalThis.fetch, priorTizen = globalThis.tizen;
  const makeService = () => service(new api.CompanionCoordinator({ read: async () => snapshot() }, 'fixture'));
  let stored, calls = [];
  try {
    const { phone, fetcher } = makeService(); globalThis.fetch = fetcher;
    globalThis.tizen = { keymanager: {
      removeData() { calls.push('remove'); },
      saveData(_name, data, _password, success) { calls.push('save'); stored = data; success(); },
      getData() { calls.push('get'); return stored; },
    } };
    const pending = await pairFrame(url);
    assert.ok(pending.comparison === phone.pairing.comparison);
    await assert.rejects(pending.confirm(), /approved/); phone.approve(); const record = await pending.confirm();
    assert.ok(savedCompanion()?.key === record.key); assert.deepEqual(calls, ['remove', 'save', 'get']);
    const second = makeService(); globalThis.fetch = second.fetcher;
    globalThis.tizen.keymanager.saveData = (_name, _data, _password, _success, fail) => fail();
    const failed = await pairFrame(url); second.phone.approve(); await assert.rejects(failed.confirm(), /Secure storage/);
    globalThis.tizen = {}; await assert.rejects(pairFrame(url), /Secure storage/); assert.equal(savedCompanion(), undefined);
    delete globalThis.tizen;
    const third = makeService(); globalThis.fetch = third.fetcher;
    const preview = await pairFrame(url); third.phone.approve(); const result = await preview.confirm();
    assert.ok(savedCompanion()?.key === result.key);
  } finally { globalThis.fetch = priorFetch; globalThis.tizen = priorTizen; }
});

test('FM/DAB controls and presets come only from reported state and capabilities', () => {
  const state = snapshot(); state.status.input = 'tuner';
  assert.equal(companionTuner(state), undefined);
  state.features.tuner = { bands: ['fm'], fmRange: { min: 87500, max: 108000, step: 50 } };
  state.tuner = { band: 'fm', frequency: 99500, station: 'Fixture FM', text: '', ready: true };
  let controls = companionTuner(state).controls;
  assert.equal(controls.filter(c => c.command.type === 'tunerTune').length, 4);
  assert.ok(!controls.some(c => ['tunerPreset', 'tunerScan', 'tunerService'].includes(c.command.type)));
  state.features.tuner = { bands: ['dab'], initialScan: true, presets: { type: 'separate', num: 8 } };
  state.tuner = { band: 'dab', station: 'Fixture DAB', text: '', ready: true, preset: 2, presets: [{ slot: 1, number: 1, band: 'fm' }, { slot: 2, number: 3, band: 'dab' }, { slot: 4, number: 8, band: 'dab' }] };
  controls = companionTuner(state).controls;
  assert.ok(controls.filter(c => c.command.type === 'tunerPreset').every(c => c.command.value === 4));
  assert.ok(controls.some(c => c.command.type === 'tunerScan' && c.command.value === 'start'));
  state.tuner.scanning = true; state.tuner.ready = false;
  controls = companionTuner(state).controls;
  assert.ok(controls.some(c => c.command.type === 'tunerScan' && c.command.value === 'cancel'));
  assert.ok(!controls.some(c => c.command.type === 'tunerService'));
});
