const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerHooks } = require('node:module');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'expo') return {
      url: `data:text/javascript,${encodeURIComponent('export const requireOptionalNativeModule = () => globalThis.addressNative;')}`, shortCircuit: true,
    };
    if (specifier === 'react-native') return {
      url: `data:text/javascript,${encodeURIComponent('export const Platform = { get OS() { return globalThis.addressPlatform ?? "ios"; } };')}`, shortCircuit: true,
    };
    if (specifier === 'expo-network') return {
      url: `data:text/javascript,${encodeURIComponent('export const getIpAddressAsync = async () => { if (globalThis.addressPlatform !== "android") throw new Error("iOS must not use Expo address lookup"); return globalThis.androidAddress; };')}`, shortCircuit: true,
    };
    if (specifier === '@mosaicast/musiccast') return {
      url: pathToFileURL(path.resolve(__dirname, '../../../packages/musiccast/dist/index.js')).href, shortCircuit: true,
    };
    return next(specifier, context);
  },
});

const { localSearchAddress } = require('../src/state/discovery.ts');
const { localSearchAddress: webAddress } = require('../src/state/discovery.web.ts');

test('iOS uses the Wi-Fi native reader rather than Expo route or last en* address', async () => {
  globalThis.addressNative = { localAddress: () => ({ address: '192.168.188.42' }) };
  assert.equal(await localSearchAddress(), '192.168.188.42');
});

test('iOS rejects invalid addresses and exposes only fixed error codes', async () => {
  for (const code of ['WIFI_UNAVAILABLE', 'WIFI_NO_IPV4', 'WIFI_NONPRIVATE_IPV4', 'INTERFACE_READ_FAILED']) {
    globalThis.addressNative = { localAddress: () => ({ code }) };
    await assert.rejects(localSearchAddress(), error => error.code === code);
  }
  for (const address of ['0.0.0.0', '169.254.1.2', '8.8.8.8', '127.0.0.1', 'fe80::1', '192.168.1.255']) {
    globalThis.addressNative = { localAddress: () => ({ address }) };
    await assert.rejects(localSearchAddress(), error => error.code === 'INVALID_ADDRESS');
  }
  for (const result of [null, {}, { code: 'untrusted native text' }]) {
    globalThis.addressNative = { localAddress: () => result };
    await assert.rejects(localSearchAddress(), error => error.code === 'NATIVE_READ_FAILED');
  }
  globalThis.addressNative = { localAddress: () => { throw new Error('raw native text'); } };
  await assert.rejects(localSearchAddress(), error => error.message === 'NATIVE_READ_FAILED');
  for (const native of [undefined, {}]) {
    globalThis.addressNative = native;
    await assert.rejects(localSearchAddress(), error => error.code === 'NATIVE_MODULE_MISSING');
  }
});

test('Android still uses its native WifiManager lookup', async () => {
  globalThis.addressPlatform = 'android'; globalThis.androidAddress = '192.168.1.12';
  try { assert.equal(await localSearchAddress(), '192.168.1.12'); }
  finally { delete globalThis.addressPlatform; delete globalThis.androidAddress; }
});

test('browser discovery never requests an address from the native or public-IP service', async () => {
  await assert.rejects(webAddress(), /native app/);
});
