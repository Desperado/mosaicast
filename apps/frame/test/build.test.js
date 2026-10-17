import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { buildApp } from '../scripts/build.js';

test('the TV artifact parses as a standalone classic script', async () => {
  new Script(await buildApp(), { filename: 'bundle.js' });
});

test('optional device presets accept only canonical private IPv4 addresses', async () => {
  new Script(await buildApp('192.168.1.20'), { filename: 'bundle.js' });
  for (const host of ['https://outside.example', '8.8.8.8', '192.168.1.20;alert(1)', '192.168.001.20']) {
    await assert.rejects(buildApp(host), /private IPv4/);
  }
});
