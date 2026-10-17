const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MusicCastClient } = require('../dist');
const { parseTunerFeatures, parseTuner, parsePresets } = require('../dist/tuner');
const advertised = { func_list: ['fm', 'dab', 'rds', 'dab_initial_scan'], range_step: [{ id: 'fm', min: 87500, max: 108000, step: 50 }], preset: { type: 'separate', num: 40 } };

function radio(options = {}) {
  let band = options.band ?? 'fm';
  let scanning = !!options.scanning;
  const calls = [];
  const fetcher = async value => {
    const url = new URL(String(value)), route = url.pathname.split('/v1/')[1], params = Object.fromEntries(url.searchParams);
    calls.push({ route, params });
    if (options.failWrite && /\/(set|recall|start|cancel)/.test(route)) throw new TypeError('Simulated disconnect after write');
    let data = {};
    if (route === 'system/getDeviceInfo') data = { model_name: 'Fictional tuner' };
    if (route === 'system/getFeatures') data = { system: { input_list: [{ id: 'tuner', play_info_type: 'tuner' }] }, zone: [{ id: 'main', input_list: ['tuner'], func_list: ['power'] }], tuner: options.unsupported ? undefined : options.noScan ? { ...advertised, func_list: ['fm', 'dab'] } : advertised };
    if (route === 'main/getStatus') data = { power: options.standby ? 'standby' : 'on', input: 'tuner' };
    if (route === 'tuner/getPlayInfo') {
      if (options.failInfo) throw new TypeError('Simulated metadata failure');
      data = { band, fm: { freq: 94500, tuned: true, preset: 1 }, rds: { program_service: 'Fictional FM', radio_text_a: 'Example show' }, dab: { status: scanning ? 'initial_scan' : options.notReady ? 'not_ready' : 'ready', service_label: 'Fictional DAB', off_air: !!options.offAir } };
    }
    if (route === 'tuner/getPresetInfo') data = { preset_info: [{ band, number: band === 'fm' ? 94500 : 100 }, { band: 'unknown', number: 0 }] };
    if (route === 'tuner/setBand' && !options.ignoreBand) band = params.band;
    if (route === 'tuner/startDabInitialScan') scanning = true;
    if (route === 'tuner/cancelDabInitialScan') scanning = false;
    return new Response(JSON.stringify({ response_code: 0, ...data }));
  };
  return { client: new MusicCastClient('192.168.1.50', fetcher, async () => {}), calls };
}
const writes = calls => calls.filter(call => /\/(set|recall|start|cancel)/.test(call.route));

test('radio capabilities and limits come only from Yamaha, malformed limits never enable tuning', () => {
  assert.equal(parseTunerFeatures(undefined), undefined);
  assert.equal(parseTunerFeatures({ func_list: ['rds'] }), undefined);
  const parsed = parseTunerFeatures(advertised);
  assert.deepEqual(parsed.bands, ['fm', 'dab']);
  assert.deepEqual(parsed.fmRange, { min: 87500, max: 108000, step: 50 });
  assert.equal(parseTunerFeatures({ ...advertised, range_step: [{ id: 'fm', min: 108000, max: 87500, step: 0 }], preset: { type: 'common', num: 999999 } }).fmRange, undefined);
  assert.equal(parseTuner({ band: 'dab' }, { bands: ['fm'] }), undefined);
  assert.deepEqual(parsePresets({ preset_info: [{ band: 'unknown', number: 0 }, { band: 'fm', number: 94500 }] }, parsed), [{ slot: 2, band: 'fm', number: 94500 }]);
});

test('radio snapshots show reported FM/RDS and DAB stations without network player requests', async () => {
  for (const band of ['fm', 'dab']) {
    const { client, calls } = radio({ band });
    const state = await client.read();
    assert.equal(state.tuner.band, band);
    assert.equal(state.tuner.station, band === 'fm' ? 'Fictional FM' : 'Fictional DAB');
    assert.equal(state.tuner.presets.length, 1);
    assert.equal(state.track, undefined);
    assert.equal(calls.some(call => call.route.startsWith('netusb/')), false);
    assert.equal(writes(calls).length, 0);
  }
  assert.equal((await radio({ failInfo: true }).client.read()).status.power, 'on');
});

test('FM seek/step, DAB service and preset recall dispatch exactly one documented write', async () => {
  for (const [options, command, route, params] of [
    [{}, { type: 'tunerTune', value: 'auto_up' }, 'tuner/setFreq', { band: 'fm', tuning: 'auto_up' }],
    [{}, { type: 'tunerTune', value: 'down' }, 'tuner/setFreq', { band: 'fm', tuning: 'down' }],
    [{ band: 'dab', offAir: true }, { type: 'tunerService', value: 'next' }, 'tuner/setDabService', { dir: 'next' }],
    [{}, { type: 'tunerPreset', value: 1 }, 'tuner/recallPreset', { zone: 'main', band: 'fm', num: '1' }],
  ]) {
    const device = radio(options);
    await device.client.execute(command);
    assert.deepEqual(writes(device.calls), [{ route, params }]);
  }
});

test('band switching requires observation; unsupported, empty, unready and standby controls send no writes', async () => {
  assert.equal((await radio().client.execute({ type: 'tunerBand', value: 'dab' })).tuner.band, 'dab');
  const ignored = radio({ ignoreBand: true });
  await assert.rejects(ignored.client.execute({ type: 'tunerBand', value: 'dab' }), /refresh/i);
  assert.equal(writes(ignored.calls).length, 1);
  for (const [options, command] of [
    [{ unsupported: true }, { type: 'tunerBand', value: 'fm' }],
    [{ standby: true }, { type: 'tunerTune', value: 'up' }],
    [{}, { type: 'tunerService', value: 'next' }],
    [{ band: 'dab' }, { type: 'tunerTune', value: 'up' }],
    [{ band: 'dab', notReady: true }, { type: 'tunerService', value: 'next' }],
    [{}, { type: 'tunerPreset', value: 2 }],
    [{}, { type: 'tunerPreset', value: 41 }],
  ]) {
    const device = radio(options);
    await assert.rejects(device.client.execute(command));
    assert.equal(writes(device.calls).length, 0);
  }
});

test('uncertain radio writes are never replayed', async () => {
  const device = radio({ failWrite: true });
  await assert.rejects(device.client.execute({ type: 'tunerTune', value: 'auto_down' }), /uncertain/);
  assert.equal(writes(device.calls).length, 1);
});


test('DAB scanning is explicit, capability-gated and cancelable without replaying writes', async () => {
  for (const [options, value, route] of [
    [{ band: 'dab', notReady: true }, 'start', 'tuner/startDabInitialScan'],
    [{ band: 'dab', scanning: true }, 'cancel', 'tuner/cancelDabInitialScan'],
  ]) {
    const device = radio(options);
    const snapshot = await device.client.execute({ type: 'tunerScan', value });
    assert.deepEqual(writes(device.calls), [{ route, params: {} }]);
    assert.equal(snapshot.tuner.scanning, value === 'start');
  }
  for (const options of [{}, { band: 'dab', noScan: true }, { band: 'dab', scanning: true }]) {
    const device = radio(options);
    await assert.rejects(device.client.execute({ type: 'tunerScan', value: 'start' }));
    assert.equal(writes(device.calls).length, 0);
  }
  const failed = radio({ band: 'dab', notReady: true, failWrite: true });
  await assert.rejects(failed.client.execute({ type: 'tunerScan', value: 'start' }), /uncertain/);
  assert.equal(writes(failed.calls).length, 1);
});
