const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAddress } = require('../src/state/address.ts');
const { privateIPv4 } = require('../../../packages/musiccast/src/parsers.ts');

test('locale commas and pasted outer whitespace become a usable private IPv4', () => {
  for (const input of ['192.168.188.194', ' 192,168,188,194\n', '192.168,188.194']) {
    const host = normalizeAddress(input);
    assert.equal(host, '192.168.188.194');
    assert.equal(privateIPv4(host), true);
    assert.equal(normalizeAddress(host), host);
  }
});

test('normalization never guesses missing octets or broadens allowed targets', () => {
  for (const input of ['192168188194', '192.168.1', '192.168.1.999', '192.168.01.40', '8,8,8,8', '127,0,0,1', '192.168.1.0', '192.168.1.255', 'yamaha.local', 'http://192.168.1.40', '192.168.1.40:80', '192.168. 1.40']) {
    assert.equal(privateIPv4(normalizeAddress(input)), false, input);
  }
});
