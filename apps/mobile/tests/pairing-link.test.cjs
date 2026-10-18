const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { registerHooks } = require('node:module');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { readFileSync } = require('node:fs');
const { transformSync } = require('esbuild');
const path = require('node:path');
const musiccast = path.resolve(__dirname, '../../../packages/musiccast/dist/index.js');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '../state/pairing-link' && context.parentURL?.endsWith('/+native-intent.tsx')) return next(specifier + '.ts', context);
    if (specifier === '@mosaicast/musiccast') return { url: pathToFileURL(musiccast).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.endsWith('/+native-intent.tsx')) return next(url, context);
    const { code } = transformSync(readFileSync(fileURLToPath(url), 'utf8'), { loader: 'tsx', format: 'esm' });
    return { format: 'module', source: code, shortCircuit: true };
  },
});
const { createPeerInvitation } = require(musiccast);
const { redirectPairingLink, takePairingLink, subscribePairingLink, launchedForPairing } = require('../src/state/pairing-link.ts');
const { redirectSystemPath } = require('../src/app/+native-intent.tsx');

test('native QR links open the pairing screen without placing their payload in the route', () => {
  const qr = createPeerInvitation(n => new Uint8Array(randomBytes(n)), '192.168.1.20');
  assert.equal(launchedForPairing(), false);
  assert.equal(redirectSystemPath({ path: qr.text, initial: true }), '/companion');
  assert.equal(launchedForPairing(), true);
  assert.ok(takePairingLink() === qr.text);
  assert.equal(takePairingLink(), undefined);
  let arrivals = 0;
  const stop = subscribePairingLink(() => { arrivals++; });
  assert.equal(redirectSystemPath({ path: qr.text.replace('mosaicast:', 'mosaicast-dev:'), initial: false }), '/companion');
  assert.equal(arrivals, 1);
  assert.ok(takePairingLink() === qr.text);
  stop();
  assert.equal(redirectPairingLink('mosaicast://pair/%'), '/companion');
  assert.equal(takePairingLink(), '', 'malformed payload becomes a safe localized error');
  assert.equal(arrivals, 1);
  assert.equal(redirectPairingLink('/settings'), '/settings');
  assert.equal(redirectPairingLink('https://example.com'), 'https://example.com');
  assert.equal(takePairingLink(), undefined);
});
