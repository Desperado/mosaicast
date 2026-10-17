const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Buffer } = require('node:buffer');
const { createBridge } = require('./bridge.cjs');
const { BrowseError } = require('../packages/musiccast/dist');
const origin = 'http://localhost:8091';
async function fixture(run) {
  const calls = [];
  const server = createBridge(host => ({
    read: async () => { calls.push({ host, read: true }); return { model: 'Example' }; },
    execute: async command => { calls.push({ host, command }); return { model: 'Example' }; },
    browse: async (input, index) => { calls.push({ host, input, index }); return { title: 'Example menu' }; },
    browseAction: async action => { calls.push({ host, action }); if (action.token === '99') throw new BrowseError('uncertainError'); return { page: { title: 'Example menu' } }; },
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  // Use node:http: fetch normalizes Host, hiding the rebinding request under test.
  const send = (body, headers = {}, route = '/command', method = 'POST') => new Promise((resolve, reject) => {
    const request = http.request(base + route, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: new Headers(response.headers), body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    request.on('error', reject);
    request.end(method === 'POST' ? JSON.stringify(body) : undefined);
  });
  try { await run(send, calls); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('bridge rejects foreign/no origins and rebinding hosts before touching a device', async () => fixture(async (send, calls) => {
  for (const headers of [{ Origin: 'https://evil.example' }, { Origin: '' }, { Host: 'evil.example' }]) {
    assert.equal((await send({ host: '192.168.1.50', command: { type: 'power', value: 'on' } }, headers)).status, 403);
  }
  assert.deepEqual(calls, []);
}));

test('bridge exposes only validated browsing inputs and actions, with typed uncertain outcomes', async () => fixture(async (send, calls) => {
  const host = '192.168.1.50';
  for (const data of [{ input: '../netusb', index: 0 }, { input: 'deezer', index: 1 }, { input: 'deezer', index: 65000 }]) {
    assert.equal((await send({ host, ...data }, {}, '/browse')).status, 400);
  }
  for (const action of [{ type: 'play', token: '1', index: -1 }, { type: 'search', token: '1', index: 0, text: '' }, { type: 'search', token: '1', index: 0, text: 'x', route: 'system/setPower' }]) {
    assert.equal((await send({ host, action }, {}, '/browse-action')).status, 400);
  }
  assert.equal(calls.length, 0);
  assert.equal((await send({ host, input: 'deezer', index: 8 }, {}, '/browse')).body.title, 'Example menu');
  const action = { type: 'search', token: '1', index: 0, text: 'Тиха музика' };
  assert.equal((await send({ host, action }, {}, '/browse-action')).status, 200);
  const uncertain = await send({ host, action: { type: 'play', token: '99', index: 0 } }, {}, '/browse-action');
  assert.equal(uncertain.status, 503);
  assert.equal(uncertain.body.code, 'uncertainError');
  assert.deepEqual(calls, [{ host, input: 'deezer', index: 8 }, { host, action }, { host, action: { type: 'play', token: '99', index: 0 } }]);
}));

test('bridge allows only private literal addresses, bounded JSON and supported commands', async () => fixture(async (send, calls) => {
  for (const host of ['8.8.8.8', 'localhost', '127.0.0.1', '192.168.1.50/path']) assert.equal((await send({ host, command: { type: 'power', value: 'on' } })).status, 400);
  for (const command of [{ type: 'power', value: 'toggle' }, { type: 'volume', value: 63 }, { type: 'input', value: '../system' }, { type: 'power', value: 'on', extra: 'bad' }]) assert.equal((await send({ host: '192.168.1.50', command })).status, 400);
  assert.equal((await send({ host: '192.168.1.50' }, {}, '/read', 'GET')).status, 400);
  assert.equal((await send({ host: '192.168.1.50' }, {}, '/raw')).status, 400);
  assert.equal((await send({ host: '192.168.1.50', padding: 'x'.repeat(5000) })).status, 413);
  assert.deepEqual(calls, []);
}));

test('bridge read sends no writes; accepted command is executed once', async () => fixture(async (send, calls) => {
  const result = await send({ host: '192.168.1.50' }, {}, '/read');
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('access-control-allow-origin'), origin);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  const command = { type: 'power', value: 'standby' };
  assert.equal((await send({ host: '192.168.1.50', command })).status, 200);
  assert.deepEqual(calls, [{ host: '192.168.1.50', read: true }, { host: '192.168.1.50', command }]);
}));

test('bridge validates radio command values before any device call', async () => fixture(async (send, calls) => {
  const host = '192.168.1.50';
  for (const command of [{ type: 'tunerBand', value: 'bogus' }, { type: 'tunerTune', value: 'direct' }, { type: 'tunerService', value: 'up' }, { type: 'tunerPreset', value: 0 }, { type: 'tunerPreset', value: 257 }, { type: 'tunerPreset', value: 1.5 }]) assert.equal((await send({ host, command })).status, 400);
  assert.equal(calls.length, 0);
  for (const command of [{ type: 'tunerBand', value: 'dab' }, { type: 'tunerTune', value: 'auto_up' }, { type: 'tunerService', value: 'previous' }, { type: 'tunerPreset', value: 1 }]) assert.equal((await send({ host, command })).status, 200);
  assert.equal(calls.length, 4);
}));
