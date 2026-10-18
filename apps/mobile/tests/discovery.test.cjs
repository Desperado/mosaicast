const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerHooks } = require('node:module');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'expo-network') return {
      url: `data:text/javascript,${encodeURIComponent(`
        export const NetworkStateType = { WIFI: 'WIFI', ETHERNET: 'ETHERNET' };
        export const getNetworkStateAsync = async () => {
          if (globalThis.networkState) return globalThis.networkState;
          throw new Error('Default route unavailable');
        };
        export const getIpAddressAsync = async () => {
          if (globalThis.localAddressError) throw new Error('Address unavailable');
          return globalThis.localAddress;
        };
      `)}`, shortCircuit: true,
    };
    if (specifier === '@mosaicast/musiccast') return {
      url: pathToFileURL(path.resolve(__dirname, '../../../packages/musiccast/dist/index.js')).href, shortCircuit: true,
    };
    return next(specifier, context);
  },
});

const { localSearchAddress } = require('../src/state/discovery.ts');
const { localSearchAddress: webAddress } = require('../src/state/discovery.web.ts');

test('a native LAN address remains usable when the default network route cannot be classified', async () => {
  for (const address of ['192.168.188.42', '10.0.0.12', '172.16.0.4']) {
    globalThis.localAddress = address;
    for (const state of [undefined, { type: 'NONE', isConnected: false }, { type: 'UNKNOWN', isConnected: true }, { type: 'CELLULAR', isConnected: true }]) {
      globalThis.networkState = state;
      assert.equal(await localSearchAddress(), address);
    }
  }
  delete globalThis.networkState;
});

test('missing, public, loopback and IPv6 addresses cannot be advertised to the TV or scanned', async () => {
  for (const address of ['0.0.0.0', '', undefined, '8.8.8.8', '127.0.0.1', 'fe80::1', '192.168.1.255']) {
    globalThis.localAddress = address;
    await assert.rejects(localSearchAddress());
  }
  globalThis.localAddressError = true;
  try { await assert.rejects(localSearchAddress(), /Address unavailable/); }
  finally { delete globalThis.localAddressError; delete globalThis.localAddress; }
});

test('browser discovery never requests an address from the native or public-IP service', async () => {
  await assert.rejects(webAddress(), /native app/);
});
