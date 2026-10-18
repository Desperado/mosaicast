const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MusicCastClient, demoController } = require('../dist');
const { parseFeatures, parseTrack, privateIPv4 } = require('../dist/parsers');

// Fictional device responses. Every fetch is injected; tests never contact LAN.
const host = '192.168.1.50';
const features = () => ({
  system: { func_list: ['wired_lan', 'airplay'], input_list: [{ id: 'deezer', play_info_type: 'netusb' }, { id: 'cd', play_info_type: 'cd' }, { id: 'tuner' }] },
  zone: [{ id: 'main', func_list: ['power', 'volume', 'mute'], input_list: ['deezer', 'cd'], range_step: [{ id: 'volume', min: 0, max: 63, step: 1 }] }],
});
function device(options = {}) {
  const calls = [];
  const status = { power: 'on', input: 'deezer', volume: 12, max_volume: 63, mute: false, ...options.status };
  let playback = 'pause', acknowledged = false, confirmationReads = 0;
  const fetcher = async (value, init) => {
    const url = new URL(String(value));
    const route = url.pathname.replace('/YamahaExtendedControl/v1/', '');
    calls.push({ route, params: Object.fromEntries(url.searchParams), init });
    let result;
    if (route === 'system/getDeviceInfo') result = { model_name: 'Example Yamaha' };
    else if (route === 'system/getFeatures') result = features();
    else if (route === 'main/getStatus') {
      if (acknowledged && ++confirmationReads <= (options.confirmationFailures || 0)) throw new TypeError('Simulated lost status reply');
      result = { ...status };
    }
    else if (route === 'netusb/getPlayInfo') {
      if (options.trackFails) throw new TypeError('Simulated unreachable');
      result = { input: status.input, track: 'Example song', artist: 'Example artist', playback };
    } else {
      if (options.writeFails) throw Object.assign(new Error('Simulated timeout'), { name: 'AbortError' });
      if (!options.ignoreWrite) {
        if (route === 'main/setPower') status.power = url.searchParams.get('power');
        else if (route === 'main/setInput') status.input = url.searchParams.get('input');
        else if (route === 'main/setMute') status.mute = url.searchParams.get('enable') === 'true';
        else if (route === 'main/setVolume') status.volume += url.searchParams.get('volume') === 'up' ? 1 : -1;
        else if (route === 'netusb/setPlayback') playback = url.searchParams.get('playback');
      }
      acknowledged = true; result = {};
    }
    return new Response(JSON.stringify({ response_code: 0, ...result }));
  };
  return { client: new MusicCastClient(host, fetcher, async () => {}), calls };
}
const writes = calls => calls.filter(call => call.route.includes('/set'));

test('only explicitly supported private IPv4 hosts can become clients', () => {
  for (const value of ['127.0.0.1', '8.8.8.8', '192.168.1.50/path', '192.168.01.50', '192.168.1.256', '172.32.1.5', 'device.local']) {
    assert.equal(privateIPv4(value), false);
    assert.throws(() => new MusicCastClient(value));
  }
  for (const value of [host, '10.20.30.40', '172.16.1.2', '172.31.1.2']) assert.equal(privateIPv4(value), true);
});

test('capabilities exclude sources outside the main zone and reject malformed payloads', () => {
  assert.deepEqual(parseFeatures(features()).sources.map(source => source.id), ['deezer', 'cd']);
  assert.throws(() => parseFeatures({ system: {}, zone: [] }), /main zone/);
});

test('artwork must stay on the device and track metadata must match current input', () => {
  const status = { power: 'on', input: 'deezer' };
  const track = { input: 'deezer', track: 'Example', playback: 'pause' };
  for (const url of ['https://external.example/image.jpg', 'http://192.168.1.51/YamahaRemoteControl/AlbumART/a.jpg', '/YamahaRemoteControl/AlbumART/a.jpg?token=example', '/other/a.jpg']) {
    assert.equal(parseTrack({ ...track, albumart_url: url }, status, host).artwork, undefined);
  }
  assert.equal(parseTrack({ ...track, albumart_url: '/YamahaRemoteControl/AlbumART/a.jpg' }, status, host).artwork, `http://${host}/YamahaRemoteControl/AlbumART/a.jpg`);
  assert.equal(parseTrack({ ...track, input: 'usb' }, status, host), undefined);
});

test('source changes disable autoplay and unsupported sources never produce writes', async () => {
  const { client, calls } = device();
  const result = await client.execute({ type: 'input', value: 'cd' });
  assert.equal(result.status.input, 'cd');
  assert.deepEqual(writes(calls)[0].params, { input: 'cd', mode: 'autoplay_disabled' });
  await assert.rejects(client.execute({ type: 'input', value: 'tuner' }), /no longer available/);
  assert.equal(writes(calls).length, 1);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].init.credentials, 'omit');
});

test('write timeout is uncertain and never retried; client can be refreshed afterward', async () => {
  const { client, calls } = device({ writeFails: true });
  await assert.rejects(client.execute({ type: 'power', value: 'standby' }), /result is uncertain/);
  assert.equal(writes(calls).length, 1);
  assert.equal((await client.read()).status.power, 'on');
});

test('acknowledgement without observed power change cannot report success', async () => {
  const { client, calls } = device({ ignoreWrite: true });
  await assert.rejects(client.execute({ type: 'power', value: 'standby' }), /did not confirm/);
  assert.equal(writes(calls).length, 1);
});

test('play/pause requires observed playback rather than just an accepted request', async () => {
  const ignored = device({ ignoreWrite: true });
  await assert.rejects(ignored.client.execute({ type: 'playback', value: 'play' }), /did not confirm/);
  assert.equal(writes(ignored.calls).length, 1);
  const working = device();
  assert.equal((await working.client.execute({ type: 'playback', value: 'play' })).track.playback, 'play');
});

test('volume at the device limit produces no writes and standby blocks volume', async () => {
  const maxed = device({ status: { volume: 20, max_volume: 20 } });
  assert.equal((await maxed.client.execute({ type: 'volume', value: 'up' })).status.volume, 20);
  assert.equal(writes(maxed.calls).length, 0);
  const standby = device({ status: { power: 'standby' } });
  await assert.rejects(standby.client.execute({ type: 'volume', value: 'down' }), /unavailable/);
  assert.equal(writes(standby.calls).length, 0);
});

test('overlapping commands are rejected before a second write', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const client = new MusicCastClient(host, async (...args) => {
    await gate;
    const route = new URL(String(args[0])).pathname;
    const result = route.endsWith('getDeviceInfo') ? { model_name: 'Example' } : route.endsWith('getFeatures') ? features() : { power: 'standby', input: 'cd' };
    return new Response(JSON.stringify({ response_code: 0, ...result }));
  });
  const first = client.execute({ type: 'power', value: 'standby' });
  await assert.rejects(client.execute({ type: 'power', value: 'on' }), /current command/);
  release();
  assert.equal((await first).status.power, 'standby');
});

test('missing track info preserves usable device status and marks unavailable metadata', async () => {
  const { client } = device({ trackFails: true });
  const result = await client.read();
  assert.equal(result.status.power, 'on');
  assert.equal(result.trackUnavailable, true);
  assert.equal(result.track, undefined);
});

test('demo instances and returned snapshots cannot change another room', async () => {
  const a = demoController(), b = demoController();
  const snapshot = await a.read();
  snapshot.status.volume = 50;
  assert.equal((await a.read()).status.volume, 12);
  await a.execute({ type: 'power', value: 'standby' });
  assert.equal((await a.read()).track, undefined);
  assert.equal((await b.read()).status.power, 'on');
});


test('demo skips wrap through fictional tracks and clear unsupported-source metadata', async () => {
  const controller = demoController();
  const original = (await controller.read()).track.title;
  await controller.execute({ type: 'playback', value: 'previous' });
  assert.notEqual((await controller.read()).track.title, original);
  await controller.execute({ type: 'playback', value: 'next' });
  assert.equal((await controller.read()).track.title, original);
  await controller.execute({ type: 'input', value: 'cd' });
  assert.equal((await controller.read()).track, undefined);
  await controller.execute({ type: 'input', value: 'server' });
  assert.equal((await controller.read()).track.title, original);
  assert.equal((await controller.read()).track.playback, 'stop');
});


test('an acknowledged volume change survives a lost confirmation read without repeating the write', async () => {
  const { client, calls } = device({ confirmationFailures: 1 });
  const result = await client.execute({ type: 'volume', value: 'up' });
  assert.equal(result.status.volume, 13);
  assert.equal(writes(calls).length, 1);
  assert.equal(calls.filter(call => call.route === 'main/getStatus').length, 4);
});

test('failed confirmation reads stay bounded and require Refresh without repeating the write', async () => {
  const { client, calls } = device({ confirmationFailures: 4 });
  await assert.rejects(client.execute({ type: 'volume', value: 'up' }), /result is uncertain/);
  assert.equal(writes(calls).length, 1);
  assert.equal(calls.filter(call => call.route === 'main/getStatus').length, 6);
});
