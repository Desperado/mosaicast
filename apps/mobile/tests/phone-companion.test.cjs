const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerHooks } = require('node:module');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { transformSync } = require('esbuild');
const { lifecycleChange } = require('../src/state/lifecycle.ts');

const musiccast = path.resolve(__dirname, '../../../packages/musiccast/dist/index.js');
const stubs = {
  // The module reads its native peer once; delegate so each test supplies its own.
  expo: 'export const requireOptionalNativeModule = () => new Proxy({}, { get: (_, key) => globalThis.peerNative[key] });',
  './discovery': "export const localSearchAddress = async () => '192.168.1.10';",
  './pairing-store': 'export const loadPairing = async () => globalThis.peerStore?.record; export const savePairing = async value => globalThis.peerStore?.save(value);',
  '@mosaicast/musiccast': `import { createRequire } from 'node:module'; const m = createRequire(${JSON.stringify(musiccast)})(${JSON.stringify(musiccast)});
export const { CompanionController, CompanionCoordinator, MusicCastClient, PhonePeerService, peerDeviceFetch } = m;`,
};
registerHooks({
  resolve(specifier, context, next) {
    if (Object.hasOwn(stubs, specifier) && (specifier[0] !== '.' || context.parentURL?.endsWith('/phone-companion.ts'))) {
      return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
    }
    return next(specifier, context);
  },
  // Node's type stripping cannot load parameter properties; compile this one module.
  load(url, context, next) {
    if (!url.endsWith('/src/state/phone-companion.ts')) return next(url, context);
    const { code } = transformSync(readFileSync(fileURLToPath(url), 'utf8'), { loader: 'ts', format: 'esm' });
    return { format: 'module', source: code, shortCircuit: true };
  },
});

function nativePeer() {
  const calls = [];
  return {
    calls,
    addListener: () => ({ remove() {} }),
    start: async host => { calls.push(['start', host]); },
    stop: () => { calls.push(['stop']); },
    respond() {},
    randomHex: length => randomBytes(length).toString('hex'),
  };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 10));

test('only background stops the phone companion; inactive system overlays keep it running', () => {
  assert.deepEqual(lifecycleChange('inactive'), { foreground: false });
  assert.deepEqual(lifecycleChange('unknown'), { foreground: false });
  assert.deepEqual(lifecycleChange('background'), { foreground: false, active: false });
  assert.deepEqual(lifecycleChange('active'), { foreground: true, active: true });
});

test('returning to the foreground restarts the listener without waiting for a Refresh, and sends no Yamaha writes', async () => {
  const native = nativePeer(), requests = [];
  globalThis.peerNative = native;
  const fetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { requests.push([String(url), init?.method ?? 'GET']); throw new Error('offline'); };
  try {
    const { PhoneCompanion } = require('../src/state/phone-companion.ts');
    const companion = new PhoneCompanion('192.168.1.20', () => {});
    await assert.rejects(companion.read());
    assert.deepEqual(native.calls, [['start', '192.168.1.10']]);
    companion.setActive(false);
    assert.deepEqual(native.calls.at(-1), ['stop']);
    // A pending Refresh means no read is issued here; the listener must still return for the TV.
    companion.setActive(true); await settle();
    assert.deepEqual(native.calls.at(-1), ['start', '192.168.1.10']);
    assert.ok(requests.every(([url]) => /\/YamahaExtendedControl\/v1\/[a-z]+\/get[A-Z]/.test(url)));
    companion.close(); companion.setActive(true); await settle();
    assert.deepEqual(native.calls.at(-1), ['stop']);
  } finally { globalThis.fetch = fetch; delete globalThis.peerNative; }
});

test('a background stop during startup polling never installs the retired controller or polling timer', async () => {
  const native = nativePeer(), live = new Set();
  globalThis.peerNative = native;
  const { fetch, setInterval: realSet, clearInterval: realClear } = globalThis;
  let release, reads = 0;
  const held = new Promise(resolve => { release = resolve; });
  globalThis.fetch = async () => { if (++reads === 1) await held; throw new Error('offline'); };
  globalThis.setInterval = (callback, ms, ...args) => { const handle = realSet(callback, ms, ...args); if (ms === 2000) live.add(handle); return handle; };
  globalThis.clearInterval = handle => { live.delete(handle); return realClear(handle); };
  try {
    const { PhoneCompanion } = require('../src/state/phone-companion.ts');
    const companion = new PhoneCompanion('192.168.1.20', () => {});
    const first = companion.read();
    while (reads === 0) await settle();
    companion.setActive(false); companion.setActive(true); await settle();
    assert.equal(native.calls.filter(([name]) => name === 'start').length, 2);
    assert.equal(live.size, 1);
    release(); await assert.rejects(first, /Inactive/); await settle();
    assert.equal(live.size, 1);
    companion.close();
    assert.equal(live.size, 0);
  } finally {
    for (const handle of live) realClear(handle);
    Object.assign(globalThis, { fetch, setInterval: realSet, clearInterval: realClear }); delete globalThis.peerNative;
  }
});


test('scanned QR accepts authenticated pairing and exposes a failed phone save until an explicit retry succeeds', async () => {
  const native = nativePeer(), statuses = [], replies = new Map(); let listener, sequence = 0, saves = 0, failSave = true;
  native.addListener = (_event, callback) => { listener = callback; return { remove() { listener = undefined; } }; };
  native.respond = (id, status, body) => { replies.get(id)({ ok: status === 200, text: async () => body }); replies.delete(id); };
  globalThis.peerNative = native;
  globalThis.peerStore = { save(value) { saves++; if (failSave) throw new Error('storage unavailable'); this.record = value; } };
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  const { createPeerInvitation, beginQRPairing, connectPeer } = require(musiccast);
  const { PhoneCompanion } = require('../src/state/phone-companion.ts');
  const companion = new PhoneCompanion('192.168.1.20', status => statuses.push(status));
  const fetcher = (address, options = {}) => new Promise(resolve => {
    const id = String(++sequence); replies.set(id, resolve);
    listener({ id, method: options.method ?? 'GET', path: new URL(address).pathname, body: options.body ?? '' });
  });
  try {
    const qr = createPeerInvitation(n => new Uint8Array(randomBytes(n)), '192.168.1.20');
    await companion.acceptInvitation(qr.text);
    assert.equal(statuses.at(-1).qr, true);
    assert.equal(statuses.at(-1).connected, false);
    const pending = await beginQRPairing('http://192.168.1.10:8095', qr.invitation, n => new Uint8Array(randomBytes(n)), fetcher);
    await assert.rejects(pending.confirm()); await settle();
    assert.equal(statuses.at(-1).saveFailed, true);
    assert.equal(statuses.at(-1).paired, false);
    assert.equal(saves, 1);
    failSave = false;
    await pending.confirm(); await settle();
    assert.equal(statuses.at(-1).saveFailed, false);
    assert.equal(statuses.at(-1).paired, true);
    assert.equal(saves, 2);
    assert.equal(statuses.at(-1).connected, false, 'a saved pair is not yet a TV connection');
    const exchange = await connectPeer(globalThis.peerStore.record, n => new Uint8Array(randomBytes(n)), fetcher);
    await exchange(); await settle();
    assert.equal(statuses.at(-1).connected, true);
    assert.equal(statuses.at(-1).qr, undefined);
    companion.setActive(false);
    assert.equal(statuses.at(-1).connected, undefined, 'a stopped listener must not claim the TV is connected');
    assert.equal(statuses.at(-1).url, undefined, 'a stopped listener must not advertise its old address');
  } finally { companion.close(); globalThis.fetch = fetch; delete globalThis.peerNative; delete globalThis.peerStore; }
});

test('foreground restart waits for an in-flight pairing save before loading the remembered pair', async () => {
  const native = nativePeer(), statuses = [], replies = new Map(), saving = Promise.withResolvers(), started = Promise.withResolvers(); let listener, sequence = 0;
  native.addListener = (_event, callback) => { listener = callback; return { remove() { listener = undefined; } }; };
  native.respond = (id, status, body) => { replies.get(id)({ ok: status === 200, text: async () => body }); replies.delete(id); };
  globalThis.peerNative = native;
  globalThis.peerStore = { async save(value) { started.resolve(); await saving.promise; this.record = value; } };
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  const { createPeerInvitation, beginQRPairing } = require(musiccast);
  const { PhoneCompanion } = require('../src/state/phone-companion.ts');
  const companion = new PhoneCompanion('192.168.1.20', status => statuses.push(status));
  const fetcher = (address, options = {}) => new Promise(resolve => {
    const id = String(++sequence); replies.set(id, resolve);
    listener({ id, method: options.method ?? 'GET', path: new URL(address).pathname, body: options.body ?? '' });
  });
  try {
    const qr = createPeerInvitation(n => new Uint8Array(randomBytes(n)), '192.168.1.20');
    await companion.acceptInvitation(qr.text);
    const pending = await beginQRPairing('http://192.168.1.10:8095', qr.invitation, n => new Uint8Array(randomBytes(n)), fetcher);
    const confirmation = assert.rejects(pending.confirm());
    await started.promise;
    companion.setActive(false); companion.setActive(true); await settle();
    assert.equal(native.calls.filter(([name]) => name === 'start').length, 1);
    saving.resolve(); await confirmation; await settle();
    assert.equal(native.calls.filter(([name]) => name === 'start').length, 2);
    assert.equal(statuses.at(-1).paired, true);
  } finally { saving.resolve(); companion.close(); globalThis.fetch = fetch; delete globalThis.peerNative; delete globalThis.peerStore; }
});


test('a listener startup failure reports a connection error instead of requesting a new native build', async () => {
  const native = nativePeer(), statuses = [];
  native.start = async () => { throw new Error('listener unavailable'); };
  globalThis.peerNative = native;
  const { PhoneCompanion } = require('../src/state/phone-companion.ts');
  const companion = new PhoneCompanion('192.168.1.20', status => statuses.push(status));
  try {
    await assert.rejects(companion.read(), /listener unavailable/);
    assert.equal(statuses.at(-1).startFailed, true);
    assert.equal(statuses.at(-1).unavailable, undefined);
    assert.equal(statuses.at(-1).url, undefined);
  } finally { companion.close(); delete globalThis.peerNative; }
});
