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
  './pairing-store': 'export const loadPairing = async () => undefined; export const savePairing = async () => {};',
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
