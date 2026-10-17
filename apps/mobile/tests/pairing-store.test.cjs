const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { registerHooks } = require('node:module');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const adapter = pathToFileURL(path.resolve(__dirname, '../../../packages/musiccast/dist/index.js')).href;
const stubs = {
  'expo-secure-store': `export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'device-only';
    export const getItemAsync = (...args) => globalThis.pairingStorage.get(...args);
    export const setItemAsync = (...args) => globalThis.pairingStorage.set(...args);`,
  '@mosaicast/musiccast': `import m from ${JSON.stringify(adapter)}; export const validPeer = m.validPeer;`,
};
registerHooks({ resolve(specifier, context, next) {
  if (Object.hasOwn(stubs, specifier) && context.parentURL?.endsWith('/pairing-store.ts')) return { url: `data:text/javascript,${encodeURIComponent(stubs[specifier])}`, shortCircuit: true };
  return next(specifier, context);
} });
const { savePairing, loadPairing } = require('../src/state/pairing-store.ts');
const record = () => ({ id: randomBytes(16).toString('hex'), key: randomBytes(32).toString('hex'), receiver: '192.168.1.20', url: 'http://192.168.1.10:8095' });

test('phone pairing is acknowledged only after reading the same record from device-only secure storage', async () => {
  const peer = record(), calls = []; let stored;
  globalThis.pairingStorage = {
    set: async (key, value, options) => { calls.push('write'); assert.equal(key, 'mosaicast.peer.v1'); assert.equal(options.keychainAccessible, 'device-only'); stored = value; },
    get: async () => { calls.push('read'); return stored; },
  };
  try {
    await savePairing(peer);
    assert.deepEqual(calls, ['write', 'read']);
    const restored = await loadPairing();
    assert.ok(restored.id === peer.id && restored.key === peer.key);
  } finally { delete globalThis.pairingStorage; }
});

test('phone pairing reports rejected writes, unreadable storage and mismatched readback', async () => {
  const peer = record();
  try {
    globalThis.pairingStorage = { set: async () => { throw new Error('write unavailable'); }, get: async () => assert.fail('no read after failed write') };
    await assert.rejects(savePairing(peer), /write unavailable/);
    globalThis.pairingStorage = { set: async () => {}, get: async () => { throw new Error('read unavailable'); } };
    await assert.rejects(savePairing(peer), /read unavailable/);
    globalThis.pairingStorage.get = async () => null;
    await assert.rejects(savePairing(peer), /storage unavailable/);
    globalThis.pairingStorage.get = async () => JSON.stringify(record());
    await assert.rejects(savePairing(peer), /storage unavailable/);
  } finally { delete globalThis.pairingStorage; }
});


test('a replacement companion cannot load the previous pair while a secure save is still running', async () => {
  const peer = record(), gate = Promise.withResolvers(), started = Promise.withResolvers(); let stored, reads = 0;
  globalThis.pairingStorage = {
    set: async (_key, value) => { started.resolve(); await gate.promise; stored = value; },
    get: async () => { reads++; return stored; },
  };
  try {
    const save = savePairing(peer); await started.promise;
    const restore = loadPairing(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(reads, 0);
    gate.resolve(); await save;
    const restored = await restore;
    assert.ok(restored.key === peer.key);
    assert.equal(reads, 2);
  } finally { gate.resolve(); delete globalThis.pairingStorage; }
});
