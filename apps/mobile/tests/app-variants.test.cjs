const assert = require('node:assert/strict');
const test = require('node:test');
const configure = require('../app.config.js');
const { expo: base } = require('../app.json');
const { build: profiles } = require('../eas.json');

function resolve(variant) {
  const previous = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try {
    return configure({ config: base });
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
}

test('local and preview apps coexist with the official app on both platforms', () => {
  const local = resolve();
  const preview = resolve(profiles.preview.env.APP_VARIANT);
  const official = resolve(profiles.production.env.APP_VARIANT);
  assert.deepEqual(preview, local);
  assert.equal(local.name, 'Mosaicast Dev');
  assert.equal(local.ios.bundleIdentifier, 'io.github.desperado.mosaicast.dev');
  assert.equal(local.android.package, 'io.github.desperado.mosaicast.dev');
  assert.equal(local.scheme, 'mosaicast-dev');
  assert.equal(official.name, 'Mosaicast');
  assert.equal(official.ios.bundleIdentifier, 'io.github.desperado.mosaicast');
  assert.equal(official.android.package, 'io.github.desperado.mosaicast');
  assert.equal(official.scheme, 'mosaicast');
  assert.deepEqual(local.ios.infoPlist, official.ios.infoPlist);
  assert.deepEqual(local.plugins, official.plugins);
  assert.equal(profiles.simulator.extends, 'preview');
  assert.equal(profiles.preview.distribution, 'internal');
  assert.equal(profiles.production.distribution, 'store');
});

test('mistyped variants fail before selecting an app identity', () => {
  assert.throws(() => resolve('developmnt'), /APP_VARIANT/);
});
