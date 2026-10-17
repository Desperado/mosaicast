import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicCast, entries, privateIPv4, validateRequest, soundControls, sources, deviceCapabilities, transport } from '../app/protocol.js';
import { demoTransport } from '../app/demo.js';

test('accept only canonical private IPv4 addresses, never arbitrary URLs or encoded hosts', () => {
  for (const host of ['192.168.188.194', '10.0.0.4', '172.16.0.1', '172.31.255.254']) assert.equal(privateIPv4(host), true);
  for (const host of ['127.0.0.1', '169.254.169.254', '8.8.8.8', '172.32.0.1', '192.168.1.256', '192.168.001.1', 'localhost', '192.168.1.1:80', '192.168.1.1@evil.com', '10.1.2.3/path']) assert.equal(privateIPv4(host), false);
});

test('a paged result preserves absolute item indices and advertised action bits', () => {
  const items = entries({ index: 16, list_info: [{ text: 'Search', attribute: 10 }, { text: 'Album', attribute: 6 }, { text: 'Track', attribute: 4 }, { text: 'Disabled', attribute: 0 }] });
  assert.deepEqual(items.map(v => [v.index, v.browse, v.play, v.search]), [[16, true, false, true], [17, true, true, false], [18, false, true, false], [19, false, false, false]]);
});

test('search is POST JSON, while list pages are bounded and index-aligned', () => {
  const spec = validateRequest('192.168.1.20', 'netusb/setSearchString', { list_id: 'main', index: 6, string: 'Björk & friends' });
  assert.equal(spec.method, 'POST');
  assert.equal(new URL(spec.url).search, '');
  assert.deepEqual(JSON.parse(spec.body), { list_id: 'main', index: 6, string: 'Björk & friends' });
  assert.throws(() => validateRequest('192.168.1.20', 'netusb/getListInfo', { input: 'deezer', index: 7, size: 8, lang: 'en', list_id: 'main' }));
  assert.throws(() => validateRequest('192.168.1.20', 'system/getAccountStatus', {}));
  assert.throws(() => validateRequest('192.168.1.20', 'main/getStatus', { unexpected: 'x' }));
});

test('device calls run serially, and a failure does not strand the queue', async () => {
  let release, count = 0;
  const events = [];
  const gate = new Promise(resolve => { release = resolve; });
  const client = new MusicCast('192.168.1.20', async () => {
    const n = ++count; events.push(`start${n}`);
    if (n === 1) { await gate; events.push('end1'); throw new Error('Offline'); }
    events.push(`end${n}`); return { response_code: 0 };
  });
  const first = client.request('main/getStatus');
  const rejected = assert.rejects(first, /Offline/);
  const second = client.request('netusb/getPlayInfo');
  await Promise.resolve();
  assert.deepEqual(events, ['start1']);
  release(); await rejected; await second; await client.tail;
  assert.deepEqual(events, ['start1', 'end1', 'start2', 'end2']);
  assert.equal(client.pending, 0);
});

test('reported device errors are surfaced to callers', async () => {
  const client = new MusicCast('192.168.1.20', async () => ({ response_code: 105 }));
  await assert.rejects(client.list(), /Reconnect the music service/);
});

test('preview rejections identify stale server or access errors separately from unreachable devices', async () => {
  const original = globalThis.fetch;
  try {
    for (const [status, message] of [[400, /Restart npm start/], [404, /Restart npm start/], [403, /rejected access/], [502, /Yamaha could not be reached/]]) {
      globalThis.fetch = async () => ({ ok: false, status });
      await assert.rejects(transport('192.168.1.20', 'main/setPower', {power: 'on'}), message);
    }
  } finally { globalThis.fetch = original; }
});

test('volume changes are single device steps and mute accepts only explicit booleans', () => {
  const spec = validateRequest('192.168.1.20', 'main/setVolume', { volume: 'down' });
  assert.equal(new URL(spec.url).searchParams.get('volume'), 'down');
  assert.equal(new URL(spec.url).searchParams.has('step'), false);
  assert.equal(new URL(validateRequest('192.168.1.20', 'main/setMute', { enable: false }).url).searchParams.get('enable'), 'false');
  for (const params of [{ volume: 63 }, { volume: 'up', step: 20 }, { volume: 'invalid' }]) assert.throws(() => validateRequest('192.168.1.20', 'main/setVolume', params));
  assert.throws(() => validateRequest('192.168.1.20', 'main/setMute', { enable: 'false' }));
});

test('sound controls respect reported capabilities and device volume limits', () => {
  const features = { zone: [{ id: 'main', func_list: ['volume', 'mute'], range_step: [{ id: 'volume', min: 0, max: 63, step: 1 }] }] };
  assert.deepEqual(soundControls(features, { volume: 0, max_volume: 63, mute: false }), { label: 'Volume 0 / 63', down: false, up: true, canMute: true, muted: false });
  assert.equal(soundControls(features, { volume: 40, max_volume: 40, mute: true }).up, false);
  assert.equal(soundControls(features, { volume: 63, mute: false }).up, false);
  assert.equal(soundControls({ zone: [] }, { volume: 12, mute: false }).up, false);
  assert.equal(soundControls(features, {}).canMute, false);
  assert.equal(soundControls(features, {}).up, false);
});

test('demo sound changes update the status without changing playback or input', async () => {
  const client = new MusicCast('10.0.0.1', demoTransport());
  const before = await client.request('main/getStatus');
  await client.request('main/setVolume', { volume: 'up' });
  await client.request('main/setMute', { enable: true });
  const after = await client.request('main/getStatus');
  assert.equal(after.volume, before.volume + 1);
  assert.equal(after.mute, true);
  assert.equal(after.input, before.input);
  assert.equal((await client.request('netusb/getPlayInfo')).playback, 'pause');
});

test('mute waits for confirmed device state, then toggles the fresh state', async () => {
  const features = { zone: [{ id: 'main', func_list: ['mute'] }] };
  let muted = false, delayedReads = 0;
  const writes = [];
  const client = new MusicCast('10.0.0.1', async (_host, route, params) => {
    if (route === 'main/setMute') { writes.push(params.enable); muted = params.enable; delayedReads = 1; return { response_code: 0 }; }
    return { response_code: 0, mute: delayedReads-- > 0 ? !muted : muted };
  });
  assert.equal((await client.sound('mute', features)).mute, true);
  assert.equal((await client.sound('mute', features)).mute, false);
  assert.deepEqual(writes, [true, false]);
});

test('sound sends no write below the device minimum or without advertised support', async () => {
  const calls = [];
  const client = new MusicCast('10.0.0.1', async (_host, route) => { calls.push(route); return { response_code: 0, volume: 0, mute: false }; });
  const features = { zone: [{ id: 'main', func_list: ['volume'], range_step: [{ id: 'volume', min: 0, max: 63 }] }] };
  await client.sound('down', features);
  await client.sound('mute', features);
  assert.deepEqual(calls, ['main/getStatus', 'main/getStatus']);
});

test('an unconfirmed sound change reports the problem without repeating the write', async () => {
  let writes = 0;
  const client = new MusicCast('10.0.0.1', async (_host, route) => {
    if (route === 'main/setMute') writes++;
    return { response_code: 0, mute: false };
  });
  await assert.rejects(client.sound('mute', { zone: [{ id: 'main', func_list: ['mute'] }] }), /not confirmed/);
  assert.equal(writes, 1);
});

test('sources include only valid inputs advertised for the main zone and distinguish browsing from receivers', () => {
  const features = { system: {input_list: [
    {id: 'deezer', play_info_type: 'netusb'}, {id: 'server', play_info_type: 'netusb'},
    {id: 'airplay', play_info_type: 'netusb'}, {id: 'spotify', play_info_type: 'netusb'},
    {id: 'cd', play_info_type: 'cd'}, {id: 'hdmi1', play_info_type: 'none'}, {id: 'future_input', play_info_type: 'none'},
    {id: '../invalid', play_info_type: 'netusb'}, {id: 'usb', play_info_type: 'netusb'}
  ]}, zone: [{id: 'main', input_list: ['deezer', 'server', 'airplay', 'spotify', 'cd', 'hdmi1', 'future_input', '../invalid']}] };
  assert.deepEqual(sources(features).map(source => [source.id, source.browse]), [['deezer', true], ['server', true], ['airplay', false], ['spotify', false], ['cd', false], ['hdmi1', false], ['future_input', false]]);
  assert.equal(sources(features).at(-1).name, 'future input');
  assert.deepEqual(sources({system: features.system, zone: [{id: 'zone2', input_list: ['deezer']}]}), []);
  assert.deepEqual(deviceCapabilities({}), []);
  assert.deepEqual(deviceCapabilities({system: {func_list: ['wireless_lan']}, tuner: {func_list: ['fm']}, distribution: {client_max: 9}}), ['Wi-Fi', 'FM radio', 'Multiroom: up to 9 clients']);
});

test('input selection verifies fresh capabilities and writes once before confirming device status', async () => {
  const calls = []; let reads = 0;
  const client = new MusicCast('10.0.0.1', async (_host, route, params) => {
    calls.push({route, params});
    if (route === 'system/getFeatures') return {response_code: 0, system: {input_list: [{id: 'cd', play_info_type: 'cd'}]}, zone: [{id: 'main', input_list: ['cd']}]};
    if (route === 'main/getStatus') return {response_code: 0, input: ++reads > 1 ? 'cd' : 'deezer'};
    return {response_code: 0};
  });
  assert.equal((await client.selectInput('cd')).input, 'cd');
  assert.deepEqual(calls.map(call => call.route), ['system/getFeatures', 'main/setInput', 'main/getStatus', 'main/getStatus']);
  assert.deepEqual(calls[1].params, {input: 'cd', mode: 'autoplay_disabled'});
  calls.length = 0;
  await assert.rejects(client.selectInput('usb'), /no longer advertises/);
  assert.deepEqual(calls.map(call => call.route), ['system/getFeatures']);
});

test('unconfirmed input selection reports failure without repeating the write', async () => {
  let writes = 0;
  const client = new MusicCast('10.0.0.1', async (_host, route) => {
    if (route === 'system/getFeatures') return {response_code: 0, system: {input_list: [{id: 'usb', play_info_type: 'netusb'}]}, zone: [{id: 'main', input_list: ['usb']}]};
    if (route === 'main/setInput') writes++;
    return {response_code: 0, input: 'deezer'};
  });
  await assert.rejects(client.selectInput('usb'), /not confirmed/);
  assert.equal(writes, 1);
});

test('source routes remain bounded and browsing passes the selected input with page limits', async () => {
  const url = new URL(validateRequest('10.0.0.1', 'main/setInput', {input: 'airplay', mode: 'autoplay_disabled'}).url);
  assert.equal(url.searchParams.get('input'), 'airplay');
  assert.equal(url.searchParams.get('mode'), 'autoplay_disabled');
  assert.throws(() => validateRequest('10.0.0.1', 'main/setInput', {input: 'cd'}));
  assert.throws(() => validateRequest('10.0.0.1', 'main/setInput', {input: 'cd', mode: 'autoplay_enabled'}));
  for (const input of ['../system', 'http://example.com', 'cd&power=on', 'x'.repeat(33)]) assert.throws(() => validateRequest('10.0.0.1', 'main/setInput', {input, mode: 'autoplay_disabled'}));
  for (const route of ['system/setWiredLan', 'system/connectBluetoothDevice', 'dist/startDistribution']) assert.throws(() => validateRequest('10.0.0.1', route, {}));
  let sent;
  const client = new MusicCast('10.0.0.1', async (_host, _route, params) => { sent = params; return {response_code: 0}; });
  await client.list(16, 'server');
  assert.deepEqual(sent, {input: 'server', index: 16, size: 8, lang: 'en', list_id: 'main'});
});

test('power commands confirm delayed state, send explicit writes once and skip redundant writes', async () => {
  const calls = []; let power = 'standby', target, reads = 0;
  const client = new MusicCast('10.0.0.1', async (_host, route, params) => {
    calls.push({route, params});
    if (route === 'system/getFeatures') return {response_code: 0, zone: [{id: 'main', func_list: ['power']}]};
    if (route === 'main/setPower') { target = params.power; reads = 0; }
    if (route === 'main/getStatus') { if (target && ++reads > 1) power = target; return {response_code: 0, power, input: 'deezer'}; }
    return {response_code: 0};
  });
  for (const target of ['on', 'standby']) {
    calls.length = 0;
    assert.equal((await client.power(target)).power, target);
    assert.deepEqual(calls.filter(call => call.route.includes('/set')), [{route: 'main/setPower', params: {power: target}}]);
    calls.length = 0;
    await client.power(target);
    assert.deepEqual(calls.map(call => call.route), ['system/getFeatures', 'main/getStatus']);
  }
});

test('power rejects unsupported capabilities and ambiguous commands without writes', async () => {
  const calls = [];
  const client = new MusicCast('10.0.0.1', async (_host, route) => { calls.push(route); return {response_code: 0, zone: [{id: 'main', func_list: []}]}; });
  await assert.rejects(client.power('toggle'), /Unsupported/);
  assert.equal(calls.length, 0);
  await assert.rejects(client.power('on'), /does not advertise/);
  assert.deepEqual(calls, ['system/getFeatures']);
  for (const power of ['toggle', 'off', 'on&input=cd', true]) assert.throws(() => validateRequest('10.0.0.1', 'main/setPower', {power}));
});

test('unconfirmed or unreachable power state reports failure without repeating the write', async () => {
  for (const unreachable of [false, true]) {
    let writes = 0;
    const client = new MusicCast('10.0.0.1', async (_host, route) => {
      if (route === 'system/getFeatures') return {response_code: 0, zone: [{id: 'main', func_list: ['power']}]};
      if (route === 'main/setPower') writes++;
      if (route === 'main/getStatus' && writes && unreachable) throw new Error('Connection failed.');
      return {response_code: 0, power: 'on'};
    });
    await assert.rejects(client.power('standby'), unreachable ? /Connection failed/ : /not confirmed/);
    assert.equal(writes, 1);
  }
});
