const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

test('native Swift reader selects Wi-Fi despite VPN and USB interfaces', { skip: process.platform !== 'darwin' }, () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'mosaicast-address-'));
  try {
    const binary = path.join(directory, 'address-test');
    execFileSync('xcrun', ['swiftc', path.resolve(__dirname, '../modules/mosaicast-peer/ios/LocalAddress.swift'), path.resolve(__dirname, 'native/main.swift'), '-o', binary]);
    assert.match(execFileSync(binary, { encoding: 'utf8' }), /passed/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
