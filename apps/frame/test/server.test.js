import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer, publicResponse } from '../scripts/server.js';

test('proxy rejects untrusted origins, secret endpoints, public hosts and oversized requests', async t => {
  let upstreamCalls = 0;
  const server = createServer(async () => { upstreamCalls++; return new Response(JSON.stringify({ response_code: 0, model_name: 'CD-NT670D' })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/musiccast`;
  const send = (payload, headers = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
  const valid = { host: '192.168.1.20', route: 'system/getDeviceInfo', params: {} };
  assert.equal((await send(valid, { Origin: 'https://evil.example' })).status, 403);
  const invalidHostStatus = await new Promise((resolve, reject) => {
    const request = http.request(url, { method: 'POST', headers: { Host: 'evil.example', 'Content-Type': 'application/json' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end(JSON.stringify(valid));
  });
  assert.equal(invalidHostStatus, 403);
  assert.equal((await send({ ...valid, host: '169.254.169.254' })).status, 400);
  assert.equal((await send({ ...valid, route: 'system/getAccountStatus' })).status, 400);
  assert.equal((await send({ ...valid, padding: 'x'.repeat(5000) })).status, 413);
  assert.equal(upstreamCalls, 0);
  const response = await send(valid);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { response_code: 0, model_name: 'CD-NT670D' });
  assert.equal(upstreamCalls, 1);
});

test('response filtering forwards only necessary fields', () => {
  const filtered = publicResponse('netusb/getListInfo', { response_code: 0, index: 8, menu_name: 'My library', list_info: [{ text: 'Album', attribute: 2, unknown_field: 'unused' }], unknown_field: 'unused' });
  assert.deepEqual(filtered, { response_code: 0, index: 8, menu_name: 'My library', list_info: [{ text: 'Album', attribute: 2 }] });
  const features = publicResponse('system/getFeatures', { response_code: 0, zone: [{ id: 'main', func_list: ['volume', 'mute'], range_step: [{ id: 'volume', min: 0, max: 63, step: 1, unknown: 'unused' }, { id: 'other', min: 0 }] }] });
  assert.deepEqual(features.zone[0].range_step, [{ id: 'volume', min: 0, max: 63, step: 1 }]);
  assert.deepEqual(publicResponse('main/getStatus', { response_code: 0, volume: 0, max_volume: 63, mute: false, unknown: 'unused' }), { response_code: 0, volume: 0, max_volume: 63, mute: false });
});

test('player metadata forwards only validated local artwork and its revision', () => {
  const data = {response_code: 0, track: 'Fixture', albumart_url: '/YamahaRemoteControl/AlbumART/AlbumART1.jpg', albumart_id: 1, unrelated: 'omit'};
  assert.deepEqual(publicResponse('netusb/getPlayInfo', data, '10.0.0.1'), {response_code: 0, track: 'Fixture', albumart_url: data.albumart_url, albumart_id: 1});
  assert.deepEqual(publicResponse('netusb/getPlayInfo', {...data, albumart_url: 'https://outside.example/image.jpg', albumart_id: 'invalid'}, '10.0.0.1'), {response_code: 0, track: 'Fixture', albumart_url: ''});
});

test('artwork proxy restricts the host, path, origin and response type and bounds image size', async t => {
  let mode = 'image', calls = [];
  const server = createServer(async (url, options) => {
    calls.push({url, options});
    return new Response(mode === 'large' ? new Uint8Array(5242881) : 'fixture image', {headers: {'Content-Type': mode === 'html' ? 'text/html' : 'image/jpeg'}});
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {server.closeAllConnections(); server.close();});
  const root = `http://127.0.0.1:${server.address().port}`;
  const imageUrl = (host = '10.0.0.1', path = '/YamahaRemoteControl/AlbumART/AlbumART1.jpg') => `${root}/api/artwork?${new URLSearchParams({host, path, revision: '1'})}`;
  assert.equal((await fetch(imageUrl('169.254.169.254'))).status, 400);
  assert.equal((await fetch(imageUrl('10.0.0.1', '/YamahaExtendedControl/v1/main/setPower?power=on'))).status, 400);
  assert.equal((await fetch(imageUrl('10.0.0.1', 'http://outside.example/a.jpg'))).status, 400);
  assert.equal((await fetch(imageUrl(), {headers: {Origin: 'https://outside.example'}})).status, 403);
  assert.equal((await fetch(`${imageUrl()}&url=forbidden`)).status, 400);
  assert.equal(calls.length, 0);
  const image = await fetch(imageUrl()); assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/jpeg');
  assert.equal(await image.text(), 'fixture image'); assert.equal(calls[0].url, 'http://10.0.0.1/YamahaRemoteControl/AlbumART/AlbumART1.jpg');
  assert.equal(calls[0].options.redirect, 'error'); assert.equal(calls[0].options.credentials, 'omit');
  mode = 'html'; assert.equal((await fetch(imageUrl())).status, 502);
  mode = 'large'; assert.equal((await fetch(imageUrl())).status, 502);
  const page = await fetch(root); assert.match(page.headers.get('content-security-policy'), /connect-src 'self' https:\/\/lrclib.net https:\/\/\*:8093 http:\/\/\*:8095;/);
});

test('capability response exposes supported connectivity only and input switching preserves proxy validation', async t => {
  const filtered = publicResponse('system/getFeatures', {response_code: 0,
    system: {func_list: ['wired_lan', 'wireless_lan'], input_list: [{id: 'cd', play_info_type: 'cd', unknown: 'omit'}], unknown: 'omit'},
    zone: [], tuner: {func_list: ['fm', 'dab'], unknown: 'omit'}, netusb: {func_list: ['play_queue'], unknown: 'omit'},
    distribution: {version: 2, client_max: 9, unknown: 'omit'}, unknown: 'omit'
  });
  assert.deepEqual(filtered, {response_code: 0, system: {func_list: ['wired_lan', 'wireless_lan'], input_list: [{id: 'cd', play_info_type: 'cd'}]}, zone: [], tuner: {func_list: ['fm', 'dab']}, netusb: {func_list: ['play_queue']}, distribution: {version: 2, client_max: 9}});
  const urls = [];
  const server = createServer(async url => {urls.push(url); return new Response(JSON.stringify({response_code: 0}));});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {server.closeAllConnections(); server.close();});
  const endpoint = `http://127.0.0.1:${server.address().port}/api/musiccast`;
  const send = (host, input) => fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({host, route: 'main/setInput', params: {input, mode: 'autoplay_disabled'}})});
  assert.equal((await send('169.254.169.254', 'cd')).status, 400);
  assert.equal((await send('10.0.0.1', '../invalid')).status, 400);
  assert.equal(urls.length, 0);
  assert.equal((await send('10.0.0.1', 'cd')).status, 200);
  assert.equal(urls[0], 'http://10.0.0.1/YamahaExtendedControl/v1/main/setInput?input=cd&mode=autoplay_disabled');
});

test('power proxy allows explicit on and standby only and keeps origin and host restrictions', async t => {
  const urls = [];
  const server = createServer(async url => {urls.push(url); return new Response(JSON.stringify({response_code: 0}));});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {server.closeAllConnections(); server.close();});
  const endpoint = `http://127.0.0.1:${server.address().port}/api/musiccast`;
  const send = (power, host = '10.0.0.1', headers = {}) => fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify({host, route: 'main/setPower', params: {power}})});
  assert.equal((await send('toggle')).status, 400);
  assert.equal((await send('on', '169.254.169.254')).status, 400);
  assert.equal((await send('standby', '10.0.0.1', {Origin: 'https://evil.example'})).status, 403);
  assert.equal(urls.length, 0);
  for (const power of ['on', 'standby']) assert.equal((await send(power)).status, 200);
  assert.deepEqual(urls, ['http://10.0.0.1/YamahaExtendedControl/v1/main/setPower?power=on', 'http://10.0.0.1/YamahaExtendedControl/v1/main/setPower?power=standby']);
});


test('theme assets load locally without exposing other files or contacting the Yamaha', async t => {
  let calls = 0;
  const server = createServer(async () => { calls++; throw new Error('Unexpected upstream request'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const root = `http://127.0.0.1:${server.address().port}`;
  const css = await fetch(`${root}/themes.css`);
  assert.equal(css.status, 200); assert.match(css.headers.get('content-type'), /^text\/css/);
  assert.match(await css.text(), /data-theme=listening-room-noir/);
  for (const asset of ['yamaha.svg', 'artist-orbits.svg']) {
    const image = await fetch(`${root}/assets/${asset}`);
    assert.equal(image.status, 200); assert.match(image.headers.get('content-type'), /^image\/svg\+xml/);
    assert.match(await image.text(), /<svg[\s>]/);
  }
  for (const font of ['Caprasimo', 'Figtree', 'InstrumentSerif', 'InstrumentSans', 'Archivo', 'IBMPlexSans', 'IBMPlexMono']) {
    const response = await fetch(`${root}/fonts/${font}.ttf`);
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /^font\/ttf/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 4)], [0, 1, 0, 0], 'TrueType signature');
  }
  for (const path of ['/assets/README.md', '/assets/unknown.svg', '/fonts/unknown.ttf', '/fonts/README.md', '/fonts/%2e%2e%2fscripts/server.js']) {
    assert.equal((await fetch(root + path)).status, 404);
  }
  assert.equal(calls, 0);
});
