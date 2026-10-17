const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createBridge } = require('./bridge.cjs');
const origin = 'http://localhost:8091';
async function fixture(run) {
  const calls = [];
  const server = createBridge(host => ({ read: async () => { calls.push({ host, read: true }); return { model: 'Example' }; }, execute: async command => { calls.push({ host, command }); return { model: 'Example' }; } }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  // Use node:http: fetch normalizes Host, hiding the rebinding request under test.
  const send = (body, headers = {}, route = '/command', method = 'POST') => new Promise((resolve, reject) => {
    const request = http.request(base + route, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...headers } }, response => {
      response.resume();
      response.on('end', () => resolve({ status: response.statusCode, headers: new Headers(response.headers) }));
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

test('bridge validates Bluetooth commands and dispatches each accepted request once', async () => fixture(async (send, calls) => {
  const host = '192.168.1.50';
  for (const command of [
    { type: 'bluetoothOutput', value: 'true' }, { type: 'bluetoothScan', value: 'stop' },
    { type: 'bluetoothDisconnect', value: true }, { type: 'bluetoothConnect', value: 'AA:BB:CC:DD:EE:FF' },
    { type: 'bluetoothConnect', value: '../setPower' }, { type: 'bluetoothConnect', value: 'AABBCCDDEEFF', route: 'other' },
  ]) assert.equal((await send({ host, command })).status, 400);
  assert.deepEqual(calls, []);
  const commands = [{ type: 'bluetoothOutput', value: true }, { type: 'bluetoothOutput', value: false }, { type: 'bluetoothScan', value: 'start' }, { type: 'bluetoothConnect', value: 'AABBCCDDEEFF' }, { type: 'bluetoothDisconnect', value: 'disconnect' }];
  for (const command of commands) assert.equal((await send({ host, command })).status, 200);
  assert.deepEqual(calls, commands.map(command => ({ host, command })));
}));
