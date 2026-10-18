import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { buildApp } from '../scripts/build.js';
import shared from '../../../packages/musiccast/dist/index.js';
import { randomBytes, webcrypto } from 'node:crypto';

// Run the real TV bundle with a small DOM fixture. No device or browser is contacted.
async function launch(tizen, { storage = new Map(), storageUnavailable = false, remote: remoteState = {}, defaultHost = '', companionFetch, webapis, discoveryFetch } = {}) {
  let document, pollPlayer;
  class Element {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {};
      this.classList = { toggle() {} }; this.hidden = false; this.disabled = false;
    }
    set textContent(value) { this.text = value; for (const child of this.children) child.parent = undefined; this.children = []; }
    get textContent() { return this.text || this.children.map(child => child.textContent).join(''); }
    get isConnected() { return this === document.documentElement || Boolean(this.parent?.isConnected); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
    contains(element) { return this === element || this.children.some(child => child.contains(element)); }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    focus() { document.activeElement = this; document.onfocusin?.({ target: this }); }
    scrollIntoView(options) { this.lastScroll = options; }
    getBoundingClientRect() {
      const box = this.bounds || { x: 400, y: 400, width: 150, height: 60 };
      return { ...box, top: box.y, bottom: box.y + box.height, left: box.x, right: box.x + box.width };
    }
    addEventListener(type, callback) { this[`on${type}`] = callback; }
    click() { if (!this.disabled) return this.onclick?.(); }
    getClientRects() { return this.hidden || (this.parent && !this.parent.getClientRects().length) ? [] : [{}]; }
    querySelectorAll(selector) {
      const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
      if (selector === '*') return all;
      if (selector.startsWith('[data-index=')) return all.filter(child => String(child.dataset.index) === selector.match(/"([^"]+)"/)[1]);
      return all.filter(child => (child.tagName === 'BUTTON' && !child.disabled) || (selector.includes('input') && child.tagName === 'INPUT'));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0]; }
  }
  const nodes = new Map();
  document = {
    documentElement: new Element('html'), visibilityState: 'visible',
    getElementById: id => nodes.get(id), createElement: tag => new Element(tag),
    addEventListener(type, callback) { this[`on${type}`] = callback; },
    querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); }
  };
  const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
  // Preserve actual nesting so hidden panels and navigation regions behave like the browser.
  const stack = [document.documentElement];
  for (const match of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/g)) {
    const [, closing, tag, attrs] = match;
    if (tag === 'html') continue;
    if (closing) { stack.pop(); continue; }
    const element = new Element(tag);
    element.hidden = /\bhidden\b/.test(attrs); element.disabled = /\bdisabled\b/.test(attrs);
    element.id = attrs.match(/\bid="([^"]+)"/)?.[1];
    if (element.id) nodes.set(element.id, element);
    stack.at(-1).append(element);
    if (!['meta', 'link', 'img', 'input'].includes(tag)) stack.push(element);
  }
  document.activeElement = document.documentElement;
  const remote = { layer: 0, menu: 'Deezer', items: [{ text: 'Charts', attribute: 2 }], input: 'deezer', inputs: [{id: 'deezer', play_info_type: 'netusb'}, {id: 'usb', play_info_type: 'netusb'}, {id: 'cd', play_info_type: 'cd'}, {id: 'tuner', play_info_type: 'tuner'}, {id: 'digital', play_info_type: 'none'}], menuCode: 0 }, calls = [];
  Object.assign(remote, remoteState);
  const rootMenu = { layer: remote.layer, menu: remote.menu, items: remote.items };
  const context = createContext({
    document, tizen, webapis, URL, URLSearchParams, TextEncoder, TextDecoder, crypto: webcrypto, AbortController, setTimeout, clearTimeout, setInterval(callback) { pollPlayer = callback; }, clearInterval() {},
    localStorage: {
      getItem(key) { if (storageUnavailable) throw new Error('Storage unavailable'); return storage.get(key) ?? null; },
      setItem(key, value) { if (storageUnavailable) throw new Error('Storage unavailable'); storage.set(key, value); }
    },
    fetch: async (_url, options) => {
      if (String(_url).includes(':8095/')) return (companionFetch || discoveryFetch)(_url, options);
      if (String(_url).startsWith('https://music.home.example.net:8093/')) return companionFetch(_url, options);
      if (String(_url).startsWith('https://lrclib.net/')) {
        calls.push({ route: 'lyrics', url: _url });
        return remote.lyrics ? remote.lyrics(_url, options) : { status: 404, ok: false };
      }
      const { route, params } = JSON.parse(options.body); calls.push({ route, params });
      if (remote.offline) throw new TypeError('Offline');
      let data = {};
      if (route === 'system/getFeatures') data = { system: { func_list: ['wired_lan', 'wireless_lan', 'bluetooth_tx_setting'], input_list: remote.inputs }, zone: [{ id: 'main', input_list: remote.inputs.map(v => v.id), func_list: remote.funcs || [] }], tuner: {func_list: ['fm', 'dab']}, distribution: {client_max: 9} };
      if (route === 'main/getStatus') data = { power: remote.power || 'on', input: remote.input, volume: remote.volume ?? 12, max_volume: remote.maxVolume, mute: remote.mute ?? false };
      if (route === 'main/setVolume') remote.volume = (remote.volume ?? 12) + (params.volume === 'up' ? 1 : -1);
      if (route === 'main/setMute') remote.mute = params.enable;
      if (route === 'main/setPower') remote.power = params.power;
      if (route === 'main/setInput') remote.input = params.input;
      if (route === 'netusb/getPlayInfo') data = { response_code: remote.playInfoCode || 0, input: 'deezer', playback: 'pause', ...remote.info };
      if (route === 'netusb/setListControl') {
        if (remote.control) remote.control(params, remote);
        else if (params.type === 'select') Object.assign(remote, { layer: remote.layer + 1, menu: remote.items[params.index].text, items: [{ text: 'Track', attribute: 4 }] });
        else if (params.type === 'return') Object.assign(remote, rootMenu);
      }
      if (route === 'netusb/getListInfo') data = { response_code: remote.menuCode, input: params.input, menu_layer: remote.layer, menu_name: remote.menu, index: params.index, max_line: remote.items.length, list_info: remote.items.slice(params.index, params.index + 8) };
      return { ok: true, json: async () => ({ response_code: 0, ...data }) };
    }
  });
  // Match the missing APIs on the declared minimum runtime, without patching Node globals.
  runInContext('Object.hasOwn = undefined', context);
  await runInContext(await buildApp(defaultHost), context);
  if (nodes.get('device-name').textContent === 'Preview mode') assert.equal(nodes.get('menu').children.length, 7, nodes.get('message').textContent);
  const key = (key, keyCode, shiftKey = false, repeat = false, timeStamp) => {
    const event = { key, keyCode, shiftKey, repeat, timeStamp, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    document.onkeydown(event); return event;
  };
  const settle = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
  const connect = async () => {
    nodes.get('settings').click(); nodes.get('dialog-input').value = '192.168.1.20';
    nodes.get('dialog-form').onsubmit({ preventDefault() {} }); await settle();
    assert.equal(nodes.get('connection-badge').textContent, 'YAMAHA CONNECTED', nodes.get('message').textContent);
    assert.equal(nodes.get('connection-badge').hidden, false);
  };
  const poll = async () => { pollPlayer(); await settle(); };
  return { nodes, document, remote, calls, storage, key, settle, connect, poll };
}

test('launch reconnects to the last successful device after restart without power, input or playback writes', async () => {
  const first = await launch(); await first.connect();
  assert.equal(first.storage.get('yamaha-host'), '192.168.1.20');
  const restarted = await launch(undefined, {storage: first.storage, defaultHost: '10.0.0.9', remote: {power: 'standby'}});
  assert.equal(restarted.nodes.get('connection-badge').textContent, 'YAMAHA CONNECTED');
  assert.match(restarted.nodes.get('device-description').textContent, /^192\.168\.1\.20 · Standby$/);
  assert.equal(restarted.nodes.get('overlay').hidden, true);
  assert.ok(restarted.calls.some(call => call.route === 'system/getDeviceInfo'));
  assert.equal(restarted.calls.some(call => /\/set|prepareInputChange/.test(call.route)), false);
});

test('an offline saved device opens connection with its address intact and can reconnect', async () => {
  const storage = new Map([['yamaha-host', '192.168.1.20']]);
  const app = await launch(undefined, {storage, remote: {offline: true}});
  assert.equal(app.nodes.get('connection-badge').hidden, true);
  assert.equal(app.nodes.get('device-name').textContent, 'Preview mode');
  assert.equal(app.nodes.get('overlay').hidden, false);
  assert.equal(app.nodes.get('dialog-input').value, '192.168.1.20');
  assert.match(app.nodes.get('dialog-error').textContent, /Could not reconnect/);
  assert.equal(storage.get('yamaha-host'), '192.168.1.20');
  app.remote.offline = false;
  app.nodes.get('dialog-form').onsubmit({preventDefault() {}}); await app.settle();
  assert.equal(app.nodes.get('connection-badge').textContent, 'YAMAHA CONNECTED');
  assert.equal(app.nodes.get('overlay').hidden, true);
});

test('a personalised install reconnects with empty or unavailable storage and saves its preset when possible', async () => {
  for (const storageUnavailable of [false, true]) {
    const app = await launch(undefined, {defaultHost: '10.0.0.9', storageUnavailable});
    assert.equal(app.nodes.get('connection-badge').textContent, 'YAMAHA CONNECTED');
    assert.match(app.nodes.get('device-description').textContent, /^10\.0\.0\.9 · Connected$/);
    if (!storageUnavailable) assert.equal(app.storage.get('yamaha-host'), '10.0.0.9');
    assert.equal(app.calls.some(call => /\/set/.test(call.route)), false);
  }
});

test('fresh generic installs and invalid saved addresses stay clearly labelled as previews without network requests', async () => {
  for (const options of [{}, {storageUnavailable: true}, {storage: new Map([['yamaha-host', 'https://outside.example']])}]) {
    const app = await launch(undefined, options);
    assert.equal(app.nodes.get('connection-badge').hidden, true);
    assert.equal(app.nodes.get('device-name').textContent, 'Preview mode');
    assert.equal(app.nodes.get('play-source').textContent, 'EXAMPLE MUSIC');
    assert.equal(app.calls.length, 0);
  }
});

test('TV registers volume keys independently and keeps controls usable if one key is unsupported', async () => {
  const registered = [], batches = [];
  const app = await launch({tvinputdevice: {
    registerKeyBatch(keys) { batches.push([...keys]); },
    registerKey(key) { registered.push(key); if (key === 'VolumeDown') throw new Error('Unsupported'); }
  }});
  assert.deepEqual(registered, ['ChannelUp', 'ChannelDown', 'VolumeUp', 'VolumeDown', 'VolumeMute']);
  assert.ok(batches[0].includes('MediaPlayPause'));
  assert.equal(app.nodes.get('remote-volume-hint').textContent, 'Yamaha volume · use onscreen controls');
  assert.equal(app.nodes.get('volume-up').disabled, false);
});

test('channel registration failures preserve other remote keys and show an onscreen fallback', async () => {
  const registered = [];
  const app = await launch({ tvinputdevice: {
    registerKeyBatch() {},
    registerKey(key) { registered.push(key); if (key === 'ChannelUp') throw new Error('Unsupported'); }
  }});
  assert.deepEqual(registered, ['ChannelUp', 'ChannelDown', 'VolumeUp', 'VolumeDown', 'VolumeMute']);
  assert.equal(app.nodes.get('remote-track-hint').textContent, 'Tracks · use onscreen previous / next');
  assert.equal(app.nodes.get('next').disabled, false);
});

test('channel rocker skips next and previous across dialogs without changing focus or queuing held keys', async () => {
  const app = await launch(); await app.connect(); app.calls.length = 0;
  const focused = app.document.activeElement;
  assert.equal(app.key('ChannelUp', 427).defaultPrevented, true);
  // Busy presses are consumed rather than queued after the first request.
  assert.equal(app.key('ChannelUp', 427).defaultPrevented, true);
  await app.settle();
  assert.equal(app.document.activeElement, focused);
  assert.deepEqual(app.calls.filter(c => c.route === 'netusb/setPlayback').map(c => c.params.playback), ['next']);
  app.key('ChannelUp', 427, false, true); await app.settle();
  assert.equal(app.calls.filter(c => c.route === 'netusb/setPlayback').length, 1);
  app.nodes.get('settings').click(); const input = app.document.activeElement;
  assert.equal(app.key('ChannelDown', 428).defaultPrevented, true); await app.settle();
  assert.equal(app.document.activeElement, input);
  assert.equal(app.nodes.get('overlay').hidden, false);
  assert.deepEqual(app.calls.filter(c => c.route === 'netusb/setPlayback').map(c => c.params.playback), ['next', 'previous']);
  assert.equal(app.calls.some(c => c.route === 'main/setPower' || c.route === 'main/setInput'), false);
  app.calls.length = 0; app.document.visibilityState = 'hidden';
  assert.equal(app.key('ChannelUp', 427).defaultPrevented, false); await app.settle();
  assert.equal(app.calls.length, 0);
});

test('channel rocker checks fresh source and power state and never sends unsupported skips', async () => {
  const app = await launch(); await app.connect();
  for (const state of [{ input: 'cd', power: 'on' }, { input: 'deezer', power: 'standby' }]) {
    Object.assign(app.remote, state); app.calls.length = 0;
    assert.equal(app.key('ChannelDown', 428).defaultPrevented, true); await app.settle();
    assert.deepEqual(app.calls.map(c => c.route), ['main/getStatus']);
  }
  Object.assign(app.remote, { input: 'usb', power: 'on' }); app.calls.length = 0;
  app.key('ChannelUp', 427); await app.settle();
  assert.equal(app.calls.find(c => c.route === 'netusb/setPlayback').params.playback, 'next');
});

test('channel skips stay simulated in preview and surface connection failures without writes', async () => {
  const app = await launch();
  assert.equal(app.nodes.get('play-state').textContent, 'Paused');
  app.key('ChannelUp', 427); await app.settle();
  assert.equal(app.nodes.get('play-state').textContent, 'Playing');
  app.key('ChannelDown', 428); await app.settle();
  assert.equal(app.nodes.get('play-state').textContent, 'Playing');
  assert.equal(app.calls.length, 0);
  await app.connect(); app.remote.offline = true; app.calls.length = 0;
  app.key('ChannelUp', 427); await app.settle();
  assert.deepEqual(app.calls.map(c => c.route), ['main/getStatus']);
  assert.match(app.nodes.get('message').textContent, /Offline/);
});

test('remote volume and mute control Yamaha across dialogs, respect limits and use fresh mute state', async () => {
  const app = await launch(); app.remote.funcs = ['volume', 'mute'];
  await app.connect(); app.calls.length = 0;
  assert.equal(app.key('VolumeUp', 447).defaultPrevented, true); await app.settle();
  assert.equal(app.remote.volume, 13);
  assert.equal(app.nodes.get('volume-level').textContent, 'Volume 13');
  app.key('VolumeDown', 448); await app.settle();
  assert.equal(app.remote.volume, 12);
  app.nodes.get('settings').click(); const focused = app.document.activeElement;
  app.key('VolumeMute', 449); await app.settle(); assert.equal(app.remote.mute, true);
  assert.equal(app.document.activeElement, focused, 'volume must not move dialog focus');
  app.remote.mute = false; // Another controller unmutes Yamaha before the next key press.
  app.key('VolumeMute', 449); await app.settle(); assert.equal(app.remote.mute, true);
  assert.equal(app.calls.filter(call => call.route === 'main/setMute').length, 2);
  app.remote.maxVolume = 12; app.calls.length = 0;
  app.key('VolumeUp', 447); await app.settle();
  assert.equal(app.calls.some(call => call.route === 'main/setVolume'), false);
  assert.equal(app.remote.volume, 12);
  assert.equal(app.calls.some(call => /setPower|setInput|setPlayback/.test(call.route)), false);
});

test('remote repeats do not queue volume changes, repeat mute or control a hidden app', async () => {
  const app = await launch(); app.remote.funcs = ['volume', 'mute'];
  await app.connect(); app.calls.length = 0;
  app.key('VolumeUp', 447);
  app.key('VolumeUp', 447, false, true); await app.settle();
  assert.equal(app.remote.volume, 13);
  assert.equal(app.calls.filter(call => call.route === 'main/setVolume').length, 1);
  app.key('VolumeMute', 449); await app.settle();
  app.key('VolumeMute', 449, false, true); await app.settle();
  assert.equal(app.remote.mute, true);
  assert.equal(app.calls.filter(call => call.route === 'main/setMute').length, 1);
  app.calls.length = 0; app.document.visibilityState = 'hidden';
  assert.equal(app.key('VolumeDown', 448).defaultPrevented, false); await app.settle();
  assert.equal(app.calls.length, 0);
});

test('remote sound keys stay local in demo and send no writes for unsupported Yamaha sound', async () => {
  const app = await launch();
  app.key('VolumeUp', 447); await app.settle();
  assert.equal(app.nodes.get('volume-level').textContent, 'Volume 13 / 63');
  assert.equal(app.calls.length, 0);
  await app.connect(); app.calls.length = 0;
  app.key('VolumeUp', 447); await app.settle();
  app.key('VolumeMute', 449); await app.settle();
  assert.equal(app.calls.some(call => call.route.startsWith('main/set')), false);
});

test('song details and covers preload before opening Now Playing; repeated refreshes reuse lyrics', async () => {
  const app = await launch();
  assert.equal(app.calls.some(call => call.route === 'lyrics'), false, 'demo never contacts a provider');
  app.remote.info = {artist: 'Fixture artist', track: 'Fixture song', album: 'Fixture album', total_time: 180, play_time: 12, albumart_url: '/YamahaRemoteControl/AlbumART/AlbumART1.jpg', albumart_id: 1};
  app.remote.lyrics = async () => ({ok: true, status: 200, json: async () => ({artistName: 'Fixture artist', trackName: 'Fixture song', albumName: 'Fixture album', duration: 180, plainLyrics: '<script>fixture text</script>\nOriginal fixture line'})});
  await app.connect();
  assert.equal(app.nodes.get('track-panel').hidden, true);
  assert.equal(app.nodes.get('detail-title').textContent, 'Fixture song');
  assert.equal(app.nodes.get('detail-artist').textContent, 'Fixture artist');
  assert.equal(app.nodes.get('detail-album').textContent, 'Fixture album');
  assert.equal(app.nodes.get('detail-time').textContent, 'Paused · 0:12 / 3:00');
  assert.match(app.nodes.get('player-cover').attributes.src, /^\/api\/artwork\?/);
  assert.equal(app.nodes.get('lyrics').textContent, '<script>fixture text</script>\nOriginal fixture line');
  assert.equal(app.nodes.get('lyrics').children.length, 0, 'lyrics are text, never HTML');
  const art = app.nodes.get('player-cover').attributes.src;
  app.nodes.get('open-track').click(); await app.settle();
  assert.equal(app.nodes.get('track-panel').hidden, false); assert.equal(app.nodes.get('menu').hidden, true);
  app.nodes.get('refresh').click(); await app.settle();
  assert.equal(app.nodes.get('player-cover').attributes.src, art);
  assert.equal(app.calls.filter(call => call.route === 'lyrics').length, 1);
  app.calls.length = 0; await app.nodes.get('back').click();
  assert.equal(app.nodes.get('track-panel').hidden, true); assert.equal(app.nodes.get('menu').hidden, false);
  assert.equal(app.calls.length, 0, 'Back from song details sends no device command');
});

test('a delayed lyric result cannot replace a new song or survive standby', async () => {
  const app = await launch(); const releases = [];
  app.remote.info = {artist: 'Fixture artist', track: 'First fixture'};
  app.remote.lyrics = async url => {
    const song = new URL(url).searchParams.get('track_name');
    await new Promise(resolve => releases.push(resolve));
    return {ok: true, status: 200, json: async () => ({artistName: 'Fixture artist', trackName: song, plainLyrics: `Original ${song} words`})};
  };
  await app.connect(); assert.equal(app.nodes.get('lyrics-status').textContent, 'Finding lyrics…');
  app.remote.info.track = 'Second fixture'; app.nodes.get('now-playing').click(); await app.settle();
  releases[1](); await app.settle(); assert.equal(app.nodes.get('lyrics').textContent, 'Original Second fixture words');
  releases[0](); await app.settle(); assert.equal(app.nodes.get('lyrics').textContent, 'Original Second fixture words');
  app.remote.info.track = 'Third fixture'; app.nodes.get('refresh').click(); await app.settle();
  assert.equal(app.nodes.get('lyrics').textContent, '');
  app.remote.power = 'standby'; app.nodes.get('refresh').click(); await app.settle();
  releases[2](); await app.settle();
  assert.equal(app.nodes.get('lyrics').hidden, true); assert.equal(app.nodes.get('lyrics').textContent, '');
  assert.equal(app.nodes.get('lyrics-status').textContent, 'Choose a song to see lyrics.');
  assert.equal(app.nodes.get('player-cover').attributes.src, undefined);
});

test('missing or failed covers and lyrics keep device controls usable and cover revisions reload images', async () => {
  const app = await launch();
  app.remote.info = {artist: 'Fixture artist', track: 'Fixture song', albumart_url: '/YamahaRemoteControl/AlbumART/AlbumART.jpg', albumart_id: 1};
  app.remote.lyrics = async () => {throw new TypeError('Offline');};
  await app.connect();
  assert.match(app.nodes.get('lyrics-status').textContent, /unavailable/);
  assert.equal(app.nodes.get('toggle-play').disabled, false);
  app.nodes.get('detail-cover').onerror(); assert.equal(app.nodes.get('detail-cover').hidden, true);
  assert.equal(app.nodes.get('cover-status').textContent, 'Album cover unavailable.');
  const oldSrc = app.nodes.get('detail-cover').attributes.src;
  app.remote.info.albumart_id = 2; app.nodes.get('now-playing').click(); await app.settle();
  assert.notEqual(app.nodes.get('detail-cover').attributes.src, oldSrc);
  app.nodes.get('detail-cover').onload(); assert.equal(app.nodes.get('detail-cover').hidden, false);
  app.remote.input = 'cd'; app.nodes.get('refresh').click(); await app.settle();
  assert.equal(app.nodes.get('detail-artist').textContent, '—');
  assert.equal(app.nodes.get('detail-cover').hidden, true);
  assert.equal(app.nodes.get('lyrics').textContent, '');
});

test('TV bundle launches and connects without Object.hasOwn or Element.replaceChildren', async () => {
  const app = await launch();
  assert.equal(app.nodes.get('volume-level').textContent, 'Volume 12 / 63');
  await app.connect();
  assert.equal(app.nodes.get('menu').children.length, 1);
  assert.equal(app.nodes.get('menu').children[0].textContent.includes('Charts'), true);
});

test('Back refreshes a changed shared menu without sending a return command', async () => {
  const app = await launch(); await app.connect();
  app.nodes.get('menu').children[0].click(); await app.settle();
  assert.equal(app.nodes.get('menu-title').textContent, 'Charts');
  for (const change of [
    { menu: 'My library' },
    { items: [{ text: 'Other album', attribute: 2 }] },
    { layer: 0 }
  ]) {
    Object.assign(app.remote, change); app.calls.length = 0;
    await app.nodes.get('back').click(); await app.settle();
    assert.equal(app.calls.some(call => call.route === 'netusb/setListControl'), false);
    assert.match(app.nodes.get('message').textContent, /menu changed/);
    assert.equal(app.nodes.get('menu-title').textContent, app.remote.menu);
  }
});

test('Back returns normally when the current shared menu still matches', async () => {
  const app = await launch(); await app.connect();
  app.nodes.get('menu').children[0].click(); await app.settle(); app.calls.length = 0;
  await app.nodes.get('back').click(); await app.settle();
  assert.deepEqual(app.calls.map(call => call.route), ['netusb/getListInfo', 'netusb/setListControl', 'netusb/getListInfo']);
  assert.equal(app.nodes.get('menu-title').textContent, 'Deezer');
});

function layoutMenu(app) {
  const cards = app.nodes.get('menu').children;
  cards.forEach((card, i) => { card.bounds = { x: 500 + (i % 2) * 400, y: 350 + Math.floor(i / 2) * 120, width: 360, height: 100 }; });
  return cards;
}

test('remote arrows stay in grid rows, remember the sidebar return and reach the player', async () => {
  const app = await launch(), { nodes, document, key } = app;
  const cards = layoutMenu(app);
  cards[0].focus(); key('ArrowRight', 39); assert.equal(document.activeElement, cards[1]);
  key('ArrowRight', 39); assert.equal(document.activeElement, cards[1], 'right edge must not jump rows');
  key('ArrowDown', 40); assert.equal(document.activeElement, cards[3]);
  key('ArrowLeft', 37); assert.equal(document.activeElement, cards[2]);
  key('ArrowLeft', 37); assert.equal(document.activeElement, nodes.get('home'));
  key('ArrowDown', 40); assert.equal(document.activeElement, nodes.get('now-playing'));
  key('ArrowRight', 39); assert.equal(document.activeElement, cards[2]);
  nodes.get('main-content').scrollTop = 210;
  cards[6].focus(); key('ArrowDown', 40); assert.equal(document.activeElement, nodes.get('toggle-play'));
  key('ArrowRight', 39); assert.equal(document.activeElement, nodes.get('next'));
  key('ArrowUp', 38); assert.equal(document.activeElement, cards[6]);
  assert.equal(nodes.get('main-content').scrollTop, 210);
  cards[0].focus(); key('ArrowUp', 38); assert.equal(document.activeElement, nodes.get('refresh'));
  key('ArrowDown', 40); assert.equal(document.activeElement, cards[0]);
});

test('Now Playing and Sources restore the menu item and scroll; Now Playing returns to Sources too', async () => {
  const app = await launch(), { nodes, document, key } = app;
  nodes.get('menu').children[5].focus(); nodes.get('main-content').scrollTop = 180;
  nodes.get('now-playing').click(); await app.settle();
  assert.equal(document.activeElement, nodes.get('toggle-play'));
  key('Escape', 27);
  assert.equal(document.activeElement, nodes.get('menu').children[5]);
  assert.equal(nodes.get('main-content').scrollTop, 180);
  nodes.get('sources').click(); await app.settle();
  const source = sourceButton(app, 'Browse USB'); source.focus();
  nodes.get('main-content').scrollTop = 500;
  nodes.get('now-playing').click(); await app.settle(); key('Escape', 27);
  assert.equal(document.activeElement.dataset.focusKey, source.dataset.focusKey);
  assert.equal(nodes.get('main-content').scrollTop, 500);
  key('Escape', 27);
  assert.equal(document.activeElement, nodes.get('menu').children[5]);
  assert.equal(nodes.get('main-content').scrollTop, 180);
});

test('Back restores a parent page and item after nested browsing, with no playback writes', async () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ text: `Collection ${i}`, attribute: 2 }));
  const app = await launch(undefined, { remote: { items } }); await app.connect();
  app.nodes.get('page-next').click(); await app.settle();
  const selected = app.nodes.get('menu').children[2]; selected.focus();
  app.nodes.get('main-content').scrollTop = 125;
  selected.click(); await app.settle();
  assert.equal(app.nodes.get('menu-title').textContent, 'Collection 10');
  app.calls.length = 0; app.key('Escape', 27); await app.settle();
  assert.equal(app.document.activeElement.dataset.index, 10);
  assert.equal(app.nodes.get('main-content').scrollTop, 125);
  assert.equal(app.nodes.get('menu-count').textContent, '9–12 of 12');
  assert.equal(app.calls.at(-1).params.index, 8);
  assert.equal(app.calls.some(call => /setPlayback|setPower|setInput/.test(call.route)), false);
});

test('held arrows are paced while separate presses move immediately; held OK does not activate', async () => {
  const app = await launch(), cards = layoutMenu(app);
  cards[0].focus();
  app.key('ArrowDown', 40, false, false, 1000); assert.equal(app.document.activeElement, cards[2]);
  app.key('ArrowDown', 40, false, true, 1040); assert.equal(app.document.activeElement, cards[2]);
  app.key('ArrowDown', 40, false, true, 1110); assert.equal(app.document.activeElement, cards[4]);
  app.key('ArrowDown', 40, false, false, 1120); assert.equal(app.document.activeElement, cards[6]);
  app.key('Enter', 13, false, true); await app.settle();
  assert.equal(app.nodes.get('overlay').hidden, true);
  app.key('Enter', 13); assert.equal(app.nodes.get('overlay').hidden, false);
  assert.equal(app.document.activeElement, app.nodes.get('dialog-input'));
  assert.equal(app.key('ArrowLeft', 37).defaultPrevented, false, 'input cursor keys remain native');
});

test('root Back asks before TV exit, defaults to keeping playback and ignores held Back or OK', async () => {
  let exits = 0;
  const app = await launch({ application: { getCurrentApplication: () => ({ exit() { exits++; } }) } });
  const { nodes, document, key } = app;
  const origin = nodes.get('menu').children[3]; origin.focus();
  key('Back', 10009); assert.equal(document.activeElement, nodes.get('cancel-exit'));
  assert.equal(nodes.get('dialog-form').hidden, true);
  assert.equal(nodes.get('use-demo').hidden, true);
  key('Back', 10009, false, true); assert.equal(nodes.get('overlay').hidden, false);
  key('Enter', 13, false, true); assert.equal(nodes.get('overlay').hidden, false);
  key('Enter', 13); assert.equal(nodes.get('overlay').hidden, true);
  assert.equal(document.activeElement, origin); assert.equal(exits, 0);
  key('Back', 10009);
  nodes.get('cancel-exit').bounds = { x: 400, y: 400, width: 200, height: 60 };
  nodes.get('confirm-exit').bounds = { x: 400, y: 500, width: 200, height: 60 };
  key('ArrowDown', 40); assert.equal(document.activeElement, nodes.get('confirm-exit'));
  key('Enter', 13); assert.equal(exits, 1);
  assert.equal(app.calls.length, 0, 'exit never changes Yamaha playback');
});

test('dialog Tab and Shift+Tab stay inside and closing restores focus', async () => {
  const app = await launch(); const { nodes, document, key } = app;
  nodes.get('settings').focus(); nodes.get('settings').click();
  const overlay = nodes.get('overlay'), first = nodes.get('close-dialog'), last = nodes.get('use-demo');
  last.focus(); assert.equal(key('Tab', 9).defaultPrevented, true); assert.equal(document.activeElement, first);
  assert.equal(key('Tab', 9, true).defaultPrevented, true); assert.equal(document.activeElement, last);
  for (let i = 0; i < 12; i++) { key('Tab', 9); assert.equal(overlay.contains(document.activeElement), true); }
  nodes.get('theme-dark').focus(); key('Enter', 13);
  assert.equal(document.activeElement, nodes.get('dialog-input'));
  assert.equal(document.documentElement.dataset.theme, 'gallery-night');
  key('Escape', 27); assert.equal(overlay.hidden, true); assert.equal(document.activeElement, nodes.get('settings'));
  document.documentElement.focus(); nodes.get('settings').click(); key('Escape', 27);
  assert.equal(document.activeElement, nodes.get('menu').children[0]);
  nodes.get('menu').children[6].click();
  nodes.get('submit-dialog').focus(); key('Tab', 9); assert.equal(document.activeElement, first);
});

test('closing Connection from Now Playing restores visible focus when the prior control is disabled', async () => {
  const app = await launch();
  app.nodes.get('now-playing').click(); await app.settle();
  app.nodes.get('toggle-play').disabled = true;
  app.nodes.get('settings').click(); app.key('Escape', 27);
  assert.equal(app.document.activeElement, app.nodes.get('sources'));
  assert.equal(app.document.activeElement.getClientRects().length, 1);
});

test('Space preserves native button activation while the media play/pause key still works', async () => {
  const app = await launch(); await app.connect(); app.calls.length = 0;
  for (const id of ['theme-dark', 'home', 'volume-up', 'mute', 'toggle-play']) {
    app.nodes.get(id).focus(); assert.equal(app.key(' ', 32).defaultPrevented, false);
  }
  await app.settle(); assert.equal(app.calls.length, 0);
  app.key('MediaPlayPause', 10252); await app.settle();
  assert.equal(app.calls[0].route, 'main/getStatus');
  assert.equal(app.calls[1].route, 'netusb/setPlayback');
  assert.equal(app.calls[1].params.playback, 'play_pause');
});

test('a stale search refreshes the background menu without moving focus out of the dialog', async () => {
  const app = await launch();
  app.remote.items = [{ text: 'Search', attribute: 10 }]; await app.connect();
  const input = app.nodes.get('dialog-input');
  app.nodes.get('menu').children[0].focus(); app.nodes.get('menu').children[0].click(); input.value = 'Artist';
  app.remote.items = [{ text: 'Different collection', attribute: 2 }]; app.calls.length = 0;
  app.nodes.get('dialog-form').onsubmit({ preventDefault() {} }); await app.settle();
  assert.equal(app.nodes.get('overlay').hidden, false);
  assert.equal(app.document.activeElement, input);
  assert.match(app.nodes.get('dialog-error').textContent, /menu changed/);
  assert.equal(app.calls.some(call => call.route === 'netusb/setSearchString'), false);
});

const sourceButton = (app, label) => app.nodes.get('source-list').querySelectorAll('button:not(:disabled)').find(button => button.attributes['aria-label'] === label);

test('rebuilding Sources restores its focused action and falls back when that action is now disabled', async () => {
  const app = await launch();
  app.nodes.get('sources').click(); await app.settle();
  const usb = sourceButton(app, 'Browse USB'); usb.focus();
  app.nodes.get('refresh').click(); await app.settle();
  assert.equal(app.document.activeElement, sourceButton(app, 'Browse USB'));
  assert.notEqual(app.document.activeElement, usb, 'focus must move to the rebuilt control');
  sourceButton(app, 'Switch Yamaha input to CD').focus(); app.key('Enter', 13); await app.settle();
  assert.equal(app.document.activeElement.isConnected, true);
  assert.equal(app.document.activeElement.disabled, false);
  assert.equal(app.nodes.get('source-list').contains(app.document.activeElement), true);
});

test('Up from Now Playing without lyrics reaches the toolbar and its controls remain reachable', async () => {
  const app = await launch(); await app.connect();
  app.nodes.get('now-playing').click(); await app.settle();
  assert.equal(app.nodes.get('lyrics-controls').hidden, true);
  app.key('ArrowUp', 38); assert.equal(app.document.activeElement, app.nodes.get('open-track'));
  app.key('ArrowRight', 39); assert.equal(app.document.activeElement, app.nodes.get('sources'));
  app.key('ArrowDown', 40); assert.equal(app.document.activeElement, app.nodes.get('toggle-play'));
  app.key('ArrowUp', 38); assert.equal(app.document.activeElement, app.nodes.get('sources'));
});

test('Up reaches lyrics that become available after Now Playing opens', async () => {
  const app = await launch(); await app.connect();
  app.nodes.get('now-playing').click(); await app.settle();
  assert.equal(app.nodes.get('lyrics-controls').hidden, true);
  // The asynchronous lyric lookup can reveal controls after the player receives focus.
  app.nodes.get('lyrics-controls').hidden = false;
  app.key('ArrowUp', 38);
  assert.equal(app.document.activeElement, app.nodes.get('lyrics-up'));
});

test('artist rooms change immediately on entry, survive Back and clear on Sources or root', async () => {
  const app = await launch(undefined, { remote: {layer: 1, menu: 'Artists', items: [{text: 'Muse', attribute: 2}]} });
  await app.connect(); app.calls.length = 0;
  app.nodes.get('menu').children[0].click();
  assert.equal(app.nodes.get('main-content').dataset.artistTone, 'cosmic', 'changes before any device response');
  await app.settle();
  assert.equal(app.nodes.get('main-content').dataset.artist, 'Muse');
  assert.equal(app.nodes.get('artist-atmosphere').hidden, false);
  app.nodes.get('open-track').click(); await app.settle();
  assert.equal(app.nodes.get('main-content').dataset.artist, '', 'empty playback has no artist room');
  app.key('Escape', 27); await app.settle();
  assert.equal(app.nodes.get('main-content').dataset.artist, 'Muse');
  app.nodes.get('sources').click(); await app.settle();
  assert.equal(app.nodes.get('artist-atmosphere').hidden, true);
  app.key('Escape', 27); await app.settle();
  assert.equal(app.nodes.get('main-content').dataset.artist, 'Muse');
  app.key('Escape', 27); await app.settle();
  assert.equal(app.nodes.get('main-content').dataset.artist, '');
  assert.equal(app.calls.some(call => /setPlayback|setInput|setPower/.test(call.route)), false);
});

test('artist backgrounds recover when playback metadata arrives after the menu', async () => {
  const artist = 'Один в каное';
  const app = await launch(undefined, {remote: {layer: 3, menu: artist}});
  await app.connect();
  assert.equal(app.nodes.get('artist-atmosphere').hidden, true);
  app.remote.info = {track: 'Небо', artist, album: artist, albumart_url: '/YamahaRemoteControl/AlbumART/AlbumART9285.jpg'};
  await app.poll();
  assert.equal(app.nodes.get('main-content').dataset.artist, artist);
  assert.equal(app.nodes.get('artist-atmosphere').hidden, false);
  assert.match(app.nodes.get('artist-cover').getAttribute('src'), /AlbumART9285.jpg/);
  app.remote.info = {track: 'Roads', artist: 'Portishead', album: 'Dummy'};
  await app.poll();
  assert.equal(app.nodes.get('main-content').dataset.artist, artist);
  assert.equal(app.nodes.get('artist-cover').getAttribute('src'), null);
});

test('commands stay quiet while pending and still show failures', async () => {
  const app = await launch(undefined, {remote: {funcs: ['volume', 'mute']}});
  await app.connect();
  app.nodes.get('volume-up').click();
  assert.equal(app.nodes.get('menu').getAttribute('aria-busy'), 'true');
  assert.equal(app.nodes.get('message').textContent, '');
  await app.settle();
  app.remote.offline = true;
  app.nodes.get('volume-up').click();
  await app.settle();
  assert.ok(app.nodes.get('message').textContent);
  assert.equal(app.nodes.get('menu').getAttribute('aria-busy'), 'false');
});

test('failed artist entry restores the prior background', async () => {
  const app = await launch(undefined, { remote: {layer: 1, menu: 'Artists', items: [{text: 'Muse', attribute: 2}]} });
  await app.connect(); app.remote.offline = true;
  app.nodes.get('menu').children[0].click();
  assert.equal(app.nodes.get('main-content').dataset.artist, 'Muse');
  await app.settle();
  assert.equal(app.nodes.get('main-content').dataset.artist, '');
  assert.equal(app.nodes.get('artist-atmosphere').hidden, true);
});

test('matching album backgrounds ignore late covers and unrelated playback while browsing', async () => {
  const info = {track: 'Take a Bow', artist: 'Muse', album: 'Black Holes and Revelations', albumart_url: '/YamahaRemoteControl/AlbumART/Muse.jpg'};
  const app = await launch(undefined, {remote: {layer: 3, menu: info.album, info}}); await app.connect();
  const cover = app.nodes.get('artist-cover');
  assert.equal(app.nodes.get('main-content').dataset.artist, 'Muse');
  assert.match(cover.getAttribute('src'), /Muse.jpg/);
  const oldLoad = cover.onload; oldLoad(); assert.equal(cover.hidden, false);
  app.remote.info = {track: 'Roads', artist: 'Portishead', album: 'Dummy', albumart_url: '/YamahaRemoteControl/AlbumART/Dummy.jpg'};
  await app.poll();
  assert.equal(app.nodes.get('main-content').dataset.artist, 'Muse');
  assert.equal(cover.getAttribute('src'), null);
  oldLoad(); assert.equal(cover.hidden, true, 'a late Muse image cannot repaint the cleared cover');
  app.nodes.get('open-track').click(); await app.settle();
  assert.equal(app.nodes.get('main-content').dataset.artist, 'Portishead');
  assert.match(cover.getAttribute('src'), /Dummy.jpg/);
  app.key('Escape', 27); await app.settle();
  assert.equal(app.nodes.get('main-content').dataset.artist, 'Muse');
  assert.equal(cover.hidden, true);
});

test('all themes preserve menu, scroll, player state and focus without device requests', async () => {
  const app = await launch(); await app.connect();
  const { nodes, document, key } = app;
  const item = nodes.get('menu').children[0]; item.focus();
  nodes.get('main-content').scrollTop = 140;
  const title = nodes.get('track-title').textContent, volume = nodes.get('volume-level').textContent;
  app.calls.length = 0;
  for (const theme of ['gallery-night', 'record-store-after-hours', 'midnight-precision', 'listening-room-noir', 'record-store', 'quiet-precision', 'warm-gallery', 'light', 'dark']) {
    nodes.get('open-themes').click();
    assert.equal(nodes.get('dialog-form').hidden, true);
    assert.equal(nodes.get('theme-options').hidden, false);
    const option = nodes.get(`theme-${theme}`); option.focus(); key('Enter', 13);
    assert.equal(document.documentElement.dataset.theme, theme);
    assert.equal(app.storage.get('frame-music-theme'), theme);
    assert.equal(option.attributes['aria-pressed'], 'true');
    assert.equal(document.activeElement, option);
    assert.equal(nodes.get('main-content').scrollTop, 140);
    assert.equal(nodes.get('menu').children[0], item);
    assert.equal(nodes.get('track-title').textContent, title);
    assert.equal(nodes.get('volume-level').textContent, volume);
    key('Escape', 27);
    assert.equal(document.activeElement, item);
    assert.equal(nodes.get('overlay').hidden, true);
  }
  assert.equal(app.calls.length, 0);
});

test('theme persistence accepts known styles, retains classic choices and rejects unknown saved IDs', async () => {
  for (const theme of ['gallery-night', 'record-store-after-hours', 'midnight-precision', 'warm-gallery', 'listening-room-noir', 'record-store', 'quiet-precision', 'light', 'dark']) {
    const app = await launch(undefined, { storage: new Map([['frame-music-theme', theme]]) });
    assert.equal(app.document.documentElement.dataset.theme, theme);
    app.nodes.get('open-themes').click();
    assert.equal(app.document.activeElement, app.nodes.get(`theme-${theme}`));
  }
  const invalid = await launch(undefined, { storage: new Map([['frame-music-theme', '__proto__']]) });
  assert.equal(invalid.document.documentElement.dataset.theme, 'gallery-night');
  assert.equal((await launch()).document.documentElement.dataset.theme, 'gallery-night');
  const blocked = await launch(undefined, { storageUnavailable: true });
  blocked.nodes.get('open-themes').click(); blocked.nodes.get('theme-record-store').click();
  assert.equal(blocked.document.documentElement.dataset.theme, 'record-store');
});

test('top navigation follows horizontal remote order and returns to content for Noir and Record Store', async () => {
  for (const theme of ['listening-room-noir', 'record-store', 'record-store-after-hours']) {
    const app = await launch(undefined, { storage: new Map([['frame-music-theme', theme]]) });
    const { nodes, document, key } = app;
    nodes.get('home').focus(); key('ArrowRight', 39);
    assert.equal(document.activeElement, nodes.get('now-playing'));
    key('ArrowRight', 39); assert.equal(document.activeElement, nodes.get('browse-sources'));
    key('ArrowLeft', 37); assert.equal(document.activeElement, nodes.get('now-playing'));
    key('ArrowDown', 40); assert.equal(document.activeElement, nodes.get('menu').children[0]);
    key('ArrowLeft', 37); assert.equal(document.activeElement, nodes.get('menu').children[0]);
    nodes.get('open-themes').focus(); key('ArrowUp', 38);
    assert.equal(document.activeElement, nodes.get('now-playing'));
  }
});

test('theme comparison keeps D-pad focus inside the dialog while the layout changes', async () => {
  const app = await launch(); const { nodes, document, key } = app;
  nodes.get('open-themes').focus(); nodes.get('open-themes').click();
  nodes.get('close-dialog').bounds = { x: 800, y: 100, width: 60, height: 60 };
  nodes.get('surface-glass').bounds = { x: 300, y: 180, width: 140, height: 60 };
  nodes.get('surface-solid').bounds = { x: 470, y: 180, width: 140, height: 60 };
  ['gallery-night', 'record-store-after-hours', 'midnight-precision', 'warm-gallery', 'listening-room-noir', 'record-store', 'quiet-precision', 'light', 'dark'].forEach((theme, i) => {
    nodes.get(`theme-${theme}`).bounds = { x: 300 + (i % 2) * 350, y: 300 + Math.floor(i / 2) * 200, width: 300, height: 150 };
  });
  key('ArrowRight', 39); assert.equal(document.activeElement, nodes.get('theme-record-store-after-hours'));
  key('Enter', 13); assert.equal(document.documentElement.dataset.theme, 'record-store-after-hours');
  assert.equal(document.activeElement, nodes.get('theme-record-store-after-hours'));
  for (let i = 0; i < 9; i++) { key('Tab', 9); assert.equal(nodes.get('overlay').contains(document.activeElement), true); }
  key('Escape', 27); assert.equal(document.activeElement, nodes.get('open-themes'));
});

test('focused menu previews expose full titles and source navigation opens Sources', async () => {
  const app = await launch();
  const card = app.nodes.get('menu').children[3]; card.focus();
  assert.equal(app.nodes.get('preview-title').textContent, card.dataset.title);
  assert.equal(card.getAttribute('aria-label'), `${card.dataset.title} · ${card.dataset.action}`);
  app.nodes.get('browse-sources').click(); await app.settle();
  assert.equal(app.nodes.get('browse-panel').hidden, true);
  assert.equal(app.nodes.get('sources-panel').hidden, false);
  app.key('Escape', 27); await app.settle();
  assert.equal(app.document.activeElement.dataset.focusKey, card.dataset.focusKey);
});

test('source picker shows device inputs and capabilities; browsing USB never switches input', async () => {
  const app = await launch(); await app.connect(); app.calls.length = 0;
  app.nodes.get('sources').click(); await app.settle();
  assert.equal(app.nodes.get('menu').hidden, true);
  assert.equal(app.nodes.get('sources-panel').hidden, false);
  assert.equal(app.nodes.get('source-list').children.length, 5);
  assert.match(app.nodes.get('capability-list').textContent, /Ethernet.*Wi-Fi.*Bluetooth output.*FM radio.*DAB radio.*9 clients/);
  app.calls.length = 0;
  sourceButton(app, 'Browse USB').click(); await app.settle();
  assert.deepEqual(app.calls.map(call => [call.route, call.params.input]), [['netusb/getListInfo', 'usb']]);
  assert.equal(app.remote.input, 'deezer');
  assert.equal(app.nodes.get('browse-label').textContent, 'USB');
  app.calls.length = 0; app.nodes.get('menu').children[0].click(); await app.settle();
  assert.equal(app.calls[0].params.input, 'usb');
  assert.equal(app.calls.at(-1).params.input, 'usb');
});

test('switching to CD updates the current input and blocks network playback commands', async () => {
  const app = await launch(); await app.connect();
  app.nodes.get('sources').click(); await app.settle(); app.calls.length = 0;
  sourceButton(app, 'Switch Yamaha input to CD').click(); await app.settle();
  assert.deepEqual(app.calls.map(call => call.route), ['system/getFeatures', 'main/setInput', 'main/getStatus']);
  assert.equal(app.remote.input, 'cd');
  assert.equal(app.nodes.get('toggle-play').disabled, true);
  assert.equal(app.nodes.get('previous').disabled, true);
  assert.match(app.nodes.get('play-source').textContent, /CD/);
  app.calls.length = 0; app.key('MediaPlayPause', 10252); await app.settle();
  assert.equal(app.calls.some(call => call.route === 'netusb/setPlayback'), false);
  assert.match(app.nodes.get('message').textContent, /Yamaha remote/);
});

test('a source removed by another client is rejected before any input write', async () => {
  const app = await launch(); await app.connect();
  app.nodes.get('sources').click(); await app.settle();
  const select = sourceButton(app, 'Switch Yamaha input to USB');
  app.remote.inputs = app.remote.inputs.filter(source => source.id !== 'usb'); app.calls.length = 0;
  select.click(); await app.settle();
  assert.deepEqual(app.calls.map(call => call.route), ['system/getFeatures']);
  assert.match(app.nodes.get('message').textContent, /no longer advertises/);
});

test('connection still shows sources when Deezer is missing or its menu is unavailable', async () => {
  for (const missing of [true, false]) {
    const app = await launch();
    if (missing) { app.remote.inputs = [{id: 'cd', play_info_type: 'cd'}]; app.remote.input = 'cd'; }
    else app.remote.menuCode = 5;
    await app.connect();
    assert.equal(app.nodes.get('sources-panel').hidden, false);
    assert.equal(app.nodes.get('source-list').children.length, missing ? 1 : 5);
    assert.equal(app.nodes.get('toggle-play').disabled, missing);
    assert.equal(app.document.activeElement.getClientRects().length > 0, true);
    if (!missing) assert.match(app.nodes.get('source-error').textContent, /Deezer menu unavailable/);
  }
});

test('opening sources and connecting only read device state; Back restores the prior menu', async () => {
  const app = await launch(); app.calls.length = 0; await app.connect();
  assert.equal(app.calls.some(call => /\/set|\/prepare/.test(call.route)), false);
  app.calls.length = 0; app.nodes.get('sources').click(); await app.settle();
  assert.equal(app.calls.some(call => /\/set|\/prepare/.test(call.route)), false);
  app.key('Escape', 27); await app.settle();
  assert.equal(app.nodes.get('menu').hidden, false);
  assert.equal(app.nodes.get('sources-panel').hidden, true);
  assert.equal(app.nodes.get('menu-title').textContent, app.remote.menu);
});

test('an empty standby menu opens Sources and explains how to resume browsing', async () => {
  const app = await launch(); app.remote.power = 'standby'; app.remote.funcs = ['power']; app.remote.items = [];
  app.calls.length = 0; await app.connect();
  assert.equal(app.nodes.get('sources-panel').hidden, false);
  assert.equal(app.nodes.get('source-list').children.length, 5);
  assert.equal(app.nodes.get('power-on').disabled, false);
  assert.equal(app.calls.some(call => /\/set|\/prepare/.test(call.route)), false);
  app.nodes.get('home').click(); await app.settle();
  assert.match(app.nodes.get('menu-count').textContent, /Power on Yamaha, then Refresh/);
});

test('an external switch to CD blocks playback even before the next player refresh', async () => {
  const app = await launch(); await app.connect();
  assert.equal(app.nodes.get('toggle-play').disabled, false);
  app.remote.input = 'cd'; app.calls.length = 0;
  app.nodes.get('toggle-play').click(); await app.settle();
  assert.deepEqual(app.calls.map(call => call.route), ['main/getStatus']);
  assert.equal(app.nodes.get('toggle-play').disabled, true);
  assert.match(app.nodes.get('play-source').textContent, /CD/);
});

test('returning to a prepared music menu after switching inputs prepares that source again', async () => {
  const app = await launch(); app.remote.funcs = ['prepare_input_change']; await app.connect();
  app.nodes.get('menu').children[0].click(); await app.settle();
  app.nodes.get('sources').click(); await app.settle();
  sourceButton(app, 'Switch Yamaha input to CD').click(); await app.settle();
  app.key('Escape', 27); await app.settle(); app.calls.length = 0;
  app.nodes.get('menu').children[0].click(); await app.settle();
  assert.equal(app.calls[0].route, 'main/prepareInputChange');
  assert.equal(app.calls[0].params.input, 'deezer');
});

test('unavailable player metadata does not prevent sources or hide confirmed input changes', async () => {
  const app = await launch(); app.remote.playInfoCode = 5; await app.connect();
  assert.match(app.nodes.get('track-title').textContent, /information unavailable/);
  assert.match(app.nodes.get('track-artist').textContent, /not ready/);
  app.nodes.get('sources').click(); await app.settle();
  sourceButton(app, 'Switch Yamaha input to USB').click(); await app.settle();
  assert.match(app.nodes.get('menu-count').textContent, /Current input: USB/);
  assert.match(app.nodes.get('play-source').textContent, /USB/);
  app.remote.power = 'standby'; app.calls.length = 0; await app.connect();
  assert.equal(app.calls.some(call => call.route === 'netusb/getPlayInfo'), false);
  assert.equal(app.nodes.get('play-state').textContent, 'Standby');
  assert.equal(app.nodes.get('toggle-play').disabled, true);
});

test('power controls update confirmed state and focus without selecting an input or playing music', async () => {
  const app = await launch(); app.remote.funcs = ['power']; await app.connect();
  assert.equal(app.nodes.get('power-state').dataset.power, 'on');
  assert.equal(app.nodes.get('power-description').textContent, 'Yamaha is on');
  assert.equal(app.nodes.get('power-on').disabled, true);
  assert.equal(app.nodes.get('power-off').disabled, false);
  app.nodes.get('sources').click(); await app.settle(); app.calls.length = 0;
  app.nodes.get('power-off').click(); await app.settle();
  assert.equal(app.remote.power, 'standby');
  assert.match(app.nodes.get('power-state').textContent, /standby/);
  assert.equal(app.nodes.get('power-state').dataset.power, 'standby');
  assert.match(app.nodes.get('device-description').textContent, /Standby/);
  assert.match(app.nodes.get('menu-count').textContent, /Standby/);
  assert.equal(app.nodes.get('toggle-play').disabled, true);
  assert.equal(app.document.activeElement, app.nodes.get('power-on'));
  assert.equal(app.calls.some(call => call.route === 'netusb/getPlayInfo'), false);
  app.nodes.get('power-on').click(); await app.settle();
  assert.equal(app.remote.power, 'on');
  assert.equal(app.nodes.get('power-state').dataset.power, 'on');
  assert.equal(app.nodes.get('power-state').children.length, 3, 'status updates preserve the logo and light');
  assert.match(app.nodes.get('device-description').textContent, /Connected/);
  assert.equal(app.nodes.get('toggle-play').disabled, false);
  assert.equal(app.document.activeElement, app.nodes.get('power-off'));
  assert.deepEqual(app.calls.filter(call => call.route.includes('/set')).map(call => [call.route, call.params.power]), [['main/setPower', 'standby'], ['main/setPower', 'on']]);
  assert.equal(app.remote.input, 'deezer');
});

test('Yamaha logo follows external power changes and distinguishes unavailable status from standby', async () => {
  const app = await launch(); await app.connect();
  app.remote.power = 'standby';
  app.nodes.get('open-track').click(); await app.settle();
  assert.equal(app.nodes.get('power-state').dataset.power, 'standby');
  app.remote.offline = true;
  app.nodes.get('refresh').click(); await app.settle();
  assert.equal(app.nodes.get('power-state').dataset.power, 'unknown');
  assert.equal(app.nodes.get('power-description').textContent, 'Yamaha power status unavailable');
  app.remote.offline = false; app.remote.power = 'on';
  app.nodes.get('refresh').click(); await app.settle();
  assert.equal(app.nodes.get('power-state').dataset.power, 'on');
  app.remote.power = 'unexpected';
  app.nodes.get('refresh').click(); await app.settle();
  assert.equal(app.nodes.get('power-state').dataset.power, 'unknown');
  assert.equal(app.calls.some(call => /\/set/.test(call.route)), false);
});

test('power controls are disabled when unsupported and reject capability removal before a write', async () => {
  const app = await launch(); await app.connect();
  assert.equal(app.nodes.get('power-on').disabled, true);
  assert.equal(app.nodes.get('power-off').disabled, true);
  app.remote.funcs = ['power']; await app.connect();
  app.remote.funcs = []; app.calls.length = 0;
  app.nodes.get('power-off').click(); await app.settle();
  assert.deepEqual(app.calls.map(call => call.route), ['system/getFeatures']);
  assert.match(app.nodes.get('message').textContent, /does not advertise/);
  assert.equal(app.remote.power, undefined);
});

test('glass and solid surfaces persist independently of themes and do not contact Yamaha', async () => {
  const app = await launch();
  assert.equal(app.document.documentElement.dataset.surface, 'glass');
  await app.connect(); app.calls.length = 0;
  const title = app.nodes.get('track-title').textContent;
  app.nodes.get('open-themes').focus(); app.nodes.get('open-themes').click();
  assert.equal(app.nodes.get('surface-options').hidden, false);
  app.nodes.get('surface-solid').focus(); app.key('Enter', 13);
  assert.equal(app.storage.get('frame-music-surface'), 'solid');
  app.nodes.get('theme-midnight-precision').click();
  assert.equal(app.document.documentElement.dataset.surface, 'solid');
  app.nodes.get('surface-glass').click();
  assert.equal(app.nodes.get('surface-glass').getAttribute('aria-pressed'), 'true');
  assert.equal(app.nodes.get('surface-solid').getAttribute('aria-pressed'), 'false');
  app.key('Escape', 27);
  assert.equal(app.document.activeElement.id, 'open-themes');
  assert.equal(app.nodes.get('track-title').textContent, title);
  assert.equal(app.calls.length, 0);
  for (const surface of ['solid', 'glass', '__proto__']) {
    const restarted = await launch(undefined, {storage: new Map([['frame-music-surface', surface]])});
    assert.equal(restarted.document.documentElement.dataset.surface, surface === 'solid' ? 'solid' : 'glass');
  }
  const blocked = await launch(undefined, {storageUnavailable: true});
  blocked.nodes.get('surface-solid').click();
  assert.equal(blocked.document.documentElement.dataset.surface, 'solid');
});

test('Help contains separate topics, traps remote focus and returns to its opener without device requests', async () => {
  const app = await launch(); await app.connect(); app.calls.length = 0;
  app.nodes.get('help').focus(); app.nodes.get('help').click();
  assert.equal(app.nodes.get('dialog-title').textContent, 'Help');
  assert.equal(app.nodes.get('dialog-form').hidden, true);
  assert.equal(app.nodes.get('help-sections').hidden, false);
  assert.equal(app.nodes.get('theme-options').hidden, true);
  assert.equal(app.nodes.get('surface-options').hidden, true);
  for (const topic of ['remote', 'playback', 'connection', 'artwork']) {
    app.nodes.get(`help-${topic}`).focus(); app.key('Enter', 13);
    assert.equal(app.nodes.get(`help-section-${topic}`).hidden, false);
    assert.equal(app.nodes.get(`help-${topic}`).getAttribute('aria-pressed'), 'true');
    for (const other of ['remote', 'playback', 'connection', 'artwork'].filter(value => value !== topic)) assert.equal(app.nodes.get(`help-section-${other}`).hidden, true);
  }
  app.nodes.get('home').focus(); app.key('ArrowRight', 39);
  assert.equal(app.document.activeElement.id, 'close-dialog');
  app.key('Escape', 27);
  assert.equal(app.document.activeElement.id, 'help');
  assert.equal(app.calls.length, 0);
  const card = app.nodes.get('menu').children[0];
  assert.equal(card.children[1].children.length, 1, 'cards show just their music title');
  const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html.split('<div id="overlay"')[0], /Audio plays on your Yamaha|Standby stops listening|Lyrics lookups send|Explore ·|ON YOUR YAMAHA/);
});

async function artistLibrary() {
  const artists = Array.from({length: 12}, (_, index) => ({text: `Artist ${index}`, attribute: 2}));
  const history = [];
  const app = await launch(undefined, {remote: {
    layer: 1, menu: 'Artists', items: artists,
    control(params, remote) {
      if (params.type === 'return') { Object.assign(remote, history.pop()); return; }
      if (params.type !== 'select') return;
      history.push({layer: remote.layer, menu: remote.menu, items: remote.items});
      const name = remote.items[params.index].text;
      Object.assign(remote, {layer: remote.layer + 1, menu: name, items: remote.menu === 'Artists' ? [{text: `${name} album`, attribute: 2}] : Array.from({length: 20}, (_, index) => ({text: `${name} song ${index}`, attribute: 4}))});
    }
  }});
  await app.connect();
  const open = async index => {
    if (index >= 8) { app.nodes.get('page-next').click(); await app.settle(); }
    const card = app.nodes.get('menu').children[index % 8]; card.focus(); card.click(); await app.settle();
    app.nodes.get('menu').children[0].focus(); app.nodes.get('menu').children[0].click(); await app.settle();
  };
  const hold = async (code, start = 1000) => {
    app.nodes.get('menu').children[0].focus();
    app.key('', code, false, false, start);
    app.key('', code, false, true, start + 300);
    app.key('', code, false, true, start + 600);
    await app.settle(); await app.settle();
  };
  const release = code => app.document.onkeyup({keyCode: code});
  return Object.assign(app, {artists, open, hold, release});
}

test('holding Left/Right pages tracks once per hold, respects edges and never starts playback', async () => {
  const app = await artistLibrary(); await app.open(7); app.calls.length = 0;
  await app.hold(39);
  assert.equal(app.nodes.get('menu-count').textContent, '9–16 of 20');
  app.key('', 39, false, true, 2500); await app.settle();
  assert.equal(app.nodes.get('menu-count').textContent, '9–16 of 20');
  app.release(39); await app.hold(39, 3000);
  assert.equal(app.nodes.get('menu-count').textContent, '17–20 of 20');
  app.release(39); await app.hold(39, 4000);
  assert.equal(app.nodes.get('menu-count').textContent, '17–20 of 20');
  app.release(39); await app.hold(37, 5000);
  assert.equal(app.nodes.get('menu-count').textContent, '9–16 of 20');
  assert.equal(app.calls.some(call => /setListControl|setPlayback|setPower|setInput/.test(call.route)), false);
});

test('held Up/Down opens adjacent artists across pages from nested albums and updates the background', async () => {
  const app = await artistLibrary(); await app.open(7); app.calls.length = 0;
  await app.hold(40);
  assert.equal(app.nodes.get('menu-title').textContent, 'Artist 8');
  assert.equal(app.nodes.get('main-content').dataset.artist, 'Artist 8');
  assert.deepEqual(app.calls.filter(call => call.route === 'netusb/setListControl').map(call => call.params.type), ['return', 'return', 'select']);
  app.key('', 40, false, true, 2500); await app.settle();
  assert.equal(app.nodes.get('menu-title').textContent, 'Artist 8');
  app.release(40); await app.hold(38, 3000);
  assert.equal(app.nodes.get('menu-title').textContent, 'Artist 7');
  assert.equal(app.calls.some(call => /setPlayback|setPower|setInput/.test(call.route)), false);
});

test('artist shortcuts stop at collection boundaries and can start from an Artists list', async () => {
  const app = await artistLibrary(); await app.open(0); app.calls.length = 0;
  await app.hold(38);
  assert.equal(app.nodes.get('menu-title').textContent, 'Artist 0 album');
  assert.equal(app.calls.length, 0);
  app.release(38); app.key('Escape', 27); await app.settle();
  app.key('Escape', 27); await app.settle();
  assert.equal(app.nodes.get('menu-title').textContent, 'Artists');
  assert.equal(app.nodes.get('menu').getAttribute('aria-busy'), 'false');
  await app.hold(40, 3000);
  assert.equal(app.nodes.get('menu-title').textContent, 'Artist 1');
  const last = await artistLibrary(); await last.open(11); last.calls.length = 0;
  await last.hold(40);
  assert.equal(last.nodes.get('menu-title').textContent, 'Artist 11 album');
  assert.equal(last.calls.length, 0);
});

test('held shortcuts reject external menu changes and a reordered artist index before selecting', async () => {
  const changed = await artistLibrary(); await changed.open(7); changed.calls.length = 0;
  changed.remote.menu = 'External menu';
  await changed.hold(40);
  assert.equal(changed.calls.some(call => call.route === 'netusb/setListControl'), false);
  assert.match(changed.nodes.get('message').textContent, /menu changed/);
  const reordered = await artistLibrary(); await reordered.open(7); reordered.calls.length = 0;
  reordered.artists[7] = {text: 'Different artist', attribute: 2};
  await reordered.hold(40);
  assert.equal(reordered.calls.some(call => call.route === 'netusb/setListControl' && call.params.type === 'select'), false);
  assert.match(reordered.nodes.get('message').textContent, /artist list changed/);
});

test('held shortcuts do not run in dialogs, after key release, when hidden or after changing screens', async () => {
  const app = await artistLibrary(); await app.open(7); app.calls.length = 0;
  app.nodes.get('help').click();
  app.key('', 39, false, false, 1000); app.key('', 39, false, true, 2000); await app.settle();
  assert.equal(app.calls.length, 0);
  app.key('Escape', 27);
  app.nodes.get('menu').children[0].focus();
  app.key('', 39, false, false, 3000); app.release(39);
  app.key('', 39, false, true, 4000); await app.settle();
  assert.equal(app.calls.length, 0);
  app.nodes.get('menu').children[0].focus();
  app.key('', 39, false, false, 5000);
  app.nodes.get('now-playing').click(); await app.settle(); app.calls.length = 0;
  app.key('', 39, false, true, 6000); await app.settle();
  assert.equal(app.calls.length, 0);
  app.key('Escape', 27);
  app.document.visibilityState = 'hidden'; await app.hold(40, 7000);
  assert.equal(app.calls.length, 0);
});


test('saved demo and missing companion credentials never fall back to the saved Yamaha address', async () => {
  for (const mode of ['demo', 'companion']) {
    const app = await launch(undefined, {storage: new Map([['mosaicast-mode', mode], ['yamaha-host', '192.168.1.20']]), defaultHost: '10.0.0.9'});
    assert.equal(app.calls.length, 0);
    assert.equal(app.nodes.get('device-name').textContent, 'Preview mode');
    assert.equal(app.nodes.get('overlay').hidden, mode === 'demo');
    assert.equal(app.storage.get('mosaicast-mode'), mode);
  }
});

test('a companion menu stall leaves Now Playing and themes usable and cannot steal their focus on completion', async () => {
  const snapshot = {model: 'Shared fixture', features: {controls: ['volume', 'mute'], connectivity: [], sources: [{id: 'deezer', name: 'Deezer', networkPlayer: true}], volumeRange: {min: 0, max: 30, step: 1}}, status: {power: 'on', input: 'deezer', volume: 10, mute: false}, trackUnavailable: false};
  const page = {input: 'deezer', token: 'menu-fixture', layer: 0, title: 'Deezer', index: 0, total: 1, items: [{index: 0, text: 'Charts', selectable: true, playable: false, searchable: false}]};
  let gate, writes = 0;
  const coordinator = new shared.CompanionCoordinator({read: async () => snapshot, execute: async () => { writes++; return snapshot; }, browse: async () => { if (gate) await gate.promise; return page; }, browseAction: async () => ({page})}, 'ui-fixture');
  await coordinator.handle('setup', {version: 1, generation: 'ui-fixture', sequence: 1, operation: {type: 'reconcile'}});
  const pairing = {url: 'http://192.168.1.10:8095', receiver: '192.168.1.20', id: randomBytes(16).toString('hex'), key: randomBytes(32).toString('hex')};
  const operations = [];
  const handle = coordinator.handle.bind(coordinator);
  coordinator.handle = (client, request) => { operations.push(request.operation.type); return handle(client, request); };
  const phone = new shared.PhonePeerService(pairing.receiver, pairing.url, coordinator, n => new Uint8Array(randomBytes(n)), pairing, async () => {});
  const app = await launch({keymanager: {getData: () => JSON.stringify(pairing)}}, {storage: new Map([['mosaicast-mode', 'companion']]), companionFetch: async (url, options = {}) => {
    const result = await phone.handle(options.method || 'GET', new URL(url).pathname, options.body ? JSON.parse(options.body) : undefined);
    return {ok: true, text: async () => JSON.stringify(result)};
  }});
  assert.equal(app.nodes.get('connection-badge').textContent, 'REFRESH CONNECTION');
  app.nodes.get('refresh').click(); await app.settle();
  app.nodes.get('source-list').querySelector('button').click(); await app.settle();
  gate = Promise.withResolvers();
  app.nodes.get('menu').children[0].click(); await app.settle();
  assert.equal(app.nodes.get('menu').getAttribute('aria-busy'), 'true');
  app.nodes.get('now-playing').click();
  assert.equal(app.nodes.get('track-panel').hidden, false);
  app.nodes.get('open-themes').click(); app.nodes.get('theme-record-store').click();
  const focus = app.document.activeElement;
  assert.equal(app.document.documentElement.dataset.theme, 'record-store');
  gate.resolve(); await app.settle();
  assert.equal(app.nodes.get('track-panel').hidden, false);
  assert.equal(app.document.activeElement, focus);
  assert.equal(app.nodes.get('overlay').hidden, false);
  assert.equal(writes, 0); assert.equal(app.calls.length, 0);
  assert.equal(operations.every(type => ['reconcile', 'browse', 'browseAction'].includes(type)), true);
});


test('shared setup automatically discovers the coordinator without pairing, device writes or focus changes', async () => {
  const requests = [];
  const app = await launch(undefined, { webapis: { network: { getIp: () => '192.168.1.30' } },
    discoveryFetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, headers: { get: () => null }, text: async () => JSON.stringify(String(url).includes('192.168.1.10:') ? { service: 'mosaicast-peer', version: 1, url: 'http://192.168.1.10:8095', epoch: randomBytes(16).toString('hex') } : {}) };
    } });
  app.nodes.get('settings').click(); app.nodes.get('pair-companion').click();
  const focused = app.document.activeElement;
  for (let i = 0; i < 3; i++) await app.settle();
  assert.equal(requests.length, 253);
  assert.ok(requests.every(({ options }) => options.method === 'GET' && !options.body && !options.headers));
  assert.equal(app.nodes.get('companion-results').children.length, 1);
  assert.equal(app.nodes.get('dialog-input').value, 'http://192.168.1.10:8095');
  assert.equal(app.document.activeElement, focused);
  assert.equal(app.calls.length, 0);
});

test('leaving shared setup cancels all discovery probes and ignores late results', async () => {
  const probes = [];
  const app = await launch(undefined, { webapis: { network: { getIp: () => '192.168.1.30' } },
    discoveryFetch: (_url, options) => new Promise(resolve => probes.push({ options, resolve })) });
  app.nodes.get('settings').click(); app.nodes.get('pair-companion').click();
  assert.equal(probes.length, 12);
  app.nodes.get('close-dialog').click();
  assert.ok(probes.every(({ options }) => options.signal.aborted));
  for (const { resolve } of probes) resolve({ ok: true, headers: { get: () => null }, text: async () => JSON.stringify({ service: 'mosaicast-peer', version: 1, url: 'http://192.168.1.10:8095', epoch: randomBytes(16).toString('hex') }) });
  await app.settle();
  assert.equal(probes.length, 12);
  assert.equal(app.nodes.get('companion-results').children.length, 0);
  assert.equal(app.nodes.get('overlay').hidden, true);
});


test('a shared Refresh clears the TV recovery warning without hiding unrelated errors', async () => {
  const snapshot = {model: 'Shared fixture', features: {controls: ['volume'], connectivity: [], sources: [{id: 'deezer', name: 'Deezer', networkPlayer: true}], volumeRange: {min: 0, max: 30, step: 1}}, status: {power: 'on', input: 'deezer', volume: 10}, trackUnavailable: false};
  let readFailed = false;
  const coordinator = new shared.CompanionCoordinator({read: async () => { if (readFailed) throw new Error('receiver unavailable'); return snapshot; }}, 'ui-fixture');
  const pairing = {url: 'http://192.168.1.10:8095', receiver: '192.168.1.20', id: randomBytes(16).toString('hex'), key: randomBytes(32).toString('hex')};
  const phone = new shared.PhonePeerService(pairing.receiver, pairing.url, coordinator, n => new Uint8Array(randomBytes(n)), pairing, async () => {});
  const app = await launch({keymanager: {getData: () => JSON.stringify(pairing)}}, {
    storage: new Map([['mosaicast-mode', 'companion']]), companionFetch: async (url, options = {}) => {
      const result = await phone.handle(options.method || 'GET', new URL(url).pathname, options.body ? JSON.parse(options.body) : undefined);
      return {ok: true, text: async () => JSON.stringify(result)};
    }
  });
  coordinator.invalidate(); await app.poll();
  assert.match(app.nodes.get('message').textContent, /[Cc]hoose Refresh/);
  assert.equal(app.nodes.get('volume-up').disabled, true);
  const handset = new shared.CompanionController(pairing.receiver, phone.localExchange);
  await handset.reconcile(); await app.poll();
  assert.equal(app.nodes.get('connection-badge').textContent, 'COMPANION CONNECTED');
  assert.equal(app.nodes.get('message').textContent, '');
  assert.equal(app.nodes.get('volume-up').disabled, false);
  readFailed = true; await coordinator.poll(); await app.poll();
  assert.equal(app.nodes.get('connection-badge').textContent, 'RECONNECTING');
  assert.match(app.nodes.get('message').textContent, /Reconnecting/);
  assert.doesNotMatch(app.nodes.get('message').textContent, /one minute|Refresh/);
  assert.equal(app.nodes.get('volume-up').disabled, true);
  readFailed = false; await coordinator.poll(); await app.poll();
  assert.equal(app.nodes.get('connection-badge').textContent, 'COMPANION CONNECTED');
  assert.equal(app.nodes.get('message').textContent, '');
  assert.equal(app.nodes.get('volume-up').disabled, false);
  app.nodes.get('message').textContent = 'Deezer menu unavailable';
  await coordinator.poll(); await app.poll();
  assert.equal(app.nodes.get('message').textContent, 'Deezer menu unavailable');
  assert.equal(app.calls.length, 0);
});
