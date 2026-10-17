import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('the packaged TV page carries its own policy: local scripts only, no plugins, LAN HTTP and lyrics', async () => {
  const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
  const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
  assert.ok(policy, 'index.html must declare a CSP; the preview server header does not reach the TV');
  const directives = Object.fromEntries(policy.split(';').map(part => part.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));
  assert.deepEqual(directives['script-src'], ["'self'"]);
  assert.deepEqual(directives['object-src'], ["'none'"]);
  assert.deepEqual(directives['base-uri'], ["'none'"]);
  assert.deepEqual(directives['connect-src'], ["'self'", 'http://*', 'http://*:8095', 'https://lrclib.net']);
  assert.ok(Object.values(directives).every(values => !values.some(value => ["'unsafe-inline'", "'unsafe-eval'", '*', 'https://*'].includes(value))));
  // Every script is a local file; inline script would be blocked on the TV.
  for (const [, attributes, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    assert.match(attributes, /src="(?!https?:|\/\/)[^"]+"/); assert.equal(body.trim(), '');
  }
  assert.doesNotMatch(html, /\sstyle="|\son[a-z]+="/);
});
