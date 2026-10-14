const { test } = require('node:test');
const assert = require('node:assert/strict');
const { en, uk, translate } = require('../dist');

test('both locales have identical nonempty translation keys', () => {
  assert.deepEqual(Object.keys(uk).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    assert.ok(translate('en', key).trim());
    assert.ok(translate('uk', key).trim());
  }
  assert.equal(translate('uk', 'powerOn'), 'Увімкнути');
  assert.notEqual(translate('en', 'demoNotice'), translate('uk', 'demoNotice'));
});
