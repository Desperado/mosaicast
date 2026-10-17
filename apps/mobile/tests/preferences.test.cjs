const { test } = require('node:test');
const assert = require('node:assert/strict');
const { defaults, parsePreferences, resolveLanguage, resolveAppearance, preferenceWriter, bluetoothDeviceKey, updateHiddenBluetoothDevices } = require('../src/state/preferences.ts');

test('saved preferences restore only known fields and reject corrupt or unknown versions', () => {
  assert.deepEqual(parsePreferences(null), defaults);
  const stored = { ...defaults, language: 'uk', appearance: 'dark', demoStarted: true, address: '192.168.1.40' };
  assert.deepEqual(parsePreferences(JSON.stringify(stored)), stored);
  assert.throws(() => parsePreferences('{broken'));
  assert.throws(() => parsePreferences('null'));
  assert.throws(() => parsePreferences('{"version":2}'));
  const sanitized = parsePreferences(JSON.stringify({ version: 1, language: 'de', appearance: false, demoStarted: 'true', address: 123, unknown: 'ignored' }));
  assert.deepEqual(sanitized, defaults);
});

test('system preferences follow OS values without overriding explicit choices', () => {
  assert.equal(resolveLanguage('system', 'uk-UA'), 'uk');
  assert.equal(resolveLanguage('system', 'de'), 'en');
  assert.equal(resolveLanguage('system', null), 'en');
  assert.equal(resolveLanguage('en', 'uk'), 'en');
  assert.equal(resolveAppearance('system', 'dark'), 'dark');
  assert.equal(resolveAppearance('system', null), 'light');
  assert.equal(resolveAppearance('dark', 'light'), 'dark');
});

test('a saved draft address never opts an old demo installation into live control', () => {
  const old = { version: 1, demoStarted: true, address: '192.168.1.40' };
  assert.equal(parsePreferences(JSON.stringify(old)).mode, 'demo');
  assert.equal(parsePreferences(JSON.stringify({ ...old, mode: 'device' })).mode, 'device');
  assert.equal(parsePreferences(JSON.stringify(old)).connection, 'direct');
  assert.equal(parsePreferences(JSON.stringify({ ...old, mode: 'device', connection: 'companion' })).connection, 'companion');
  assert.equal(parsePreferences(JSON.stringify({ ...old, connection: 'unknown' })).connection, 'direct');
});

test('rapid changes persist in order even when an earlier write fails', async () => {
  const calls = [];
  let release;
  const first = new Promise(resolve => { release = resolve; });
  const write = preferenceWriter(async value => {
    const saved = JSON.parse(value);
    calls.push(saved.language);
    if (saved.language === 'en') { await first; throw new Error('Storage unavailable'); }
  });
  const a = write({ ...defaults, language: 'en' });
  const rejected = assert.rejects(a, /Storage unavailable/);
  const b = write({ ...defaults, language: 'uk' });
  await Promise.resolve();
  assert.deepEqual(calls, ['en']);
  release();
  await rejected;
  await b;
  assert.deepEqual(calls, ['en', 'uk']);
});

test('removed headphones stay removed after reload and can be restored for one Yamaha only', () => {
  const first = '192.168.1.40', other = '192.168.1.41';
  const address = 'aabbccddeeff';
  let hidden = updateHiddenBluetoothDevices([], first, address);
  hidden = updateHiddenBluetoothDevices(hidden, other, address);
  hidden = updateHiddenBluetoothDevices(hidden, first, address.toUpperCase());
  assert.equal(hidden.length, 2);
  const restored = parsePreferences(JSON.stringify({ ...defaults, hiddenBluetoothDevices: hidden }));
  assert.ok(restored.hiddenBluetoothDevices.includes(bluetoothDeviceKey(first, address)));
  assert.deepEqual(updateHiddenBluetoothDevices(restored.hiddenBluetoothDevices, first), [bluetoothDeviceKey(other, address)]);
  assert.deepEqual(parsePreferences('{"version":1,"mode":"device","address":"192.168.1.40"}'), { ...defaults, mode: 'device', address: first });
});

test('removed headphone records reject malformed values and stay bounded', () => {
  const valid = '192.168.1.40/AABBCCDDEEFF';
  const preferences = parsePreferences(JSON.stringify({ ...defaults, hiddenBluetoothDevices: [null, {}, '../bad', '192.168.1.40/invalid', valid.toLowerCase(), valid] }));
  assert.deepEqual(preferences.hiddenBluetoothDevices, [valid]);
  const many = Array.from({ length: 600 }, (_, index) => bluetoothDeviceKey('192.168.1.40', index.toString(16).padStart(12, '0')));
  assert.equal(parsePreferences(JSON.stringify({ ...defaults, hiddenBluetoothDevices: many })).hiddenBluetoothDevices.length, 512);
  assert.equal(updateHiddenBluetoothDevices(many, '192.168.1.41', '001122334455').length, 512);
});
