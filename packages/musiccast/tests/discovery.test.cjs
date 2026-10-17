const { test } = require('node:test');
const assert = require('node:assert/strict');
const { discoverMusicCast, discoverPeers, discoveryPrefix } = require('../dist/discovery');
const reply = value => new Response(JSON.stringify(value));

test('search stays inside the private /24, skips this device, and bounds concurrent read-only requests', async () => {
  const requests = [], found = [];
  let pending = 0, peak = 0;
  const result = await discoverMusicCast('192.168.188.42', {
    signal: new AbortController().signal,
    onDevice: device => found.push(device),
    fetcher: async (url, init) => {
      const parsed = new URL(url);
      requests.push(parsed.hostname);
      assert.equal(parsed.pathname, '/YamahaExtendedControl/v1/system/getDeviceInfo');
      assert.equal(parsed.search, '');
      assert.equal(init.method, 'GET');
      assert.equal(init.redirect, 'error');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.cache, 'no-store');
      peak = Math.max(peak, ++pending);
      await new Promise(resolve => setTimeout(resolve, 0));
      pending--;
      return parsed.hostname.endsWith('.194') ? reply({ response_code: 0, model_name: ' CD-NT670D ' }) : new Response('', { status: 404 });
    },
  });
  assert.equal(requests.length, 253);
  assert.equal(new Set(requests).size, 253);
  assert.ok(!requests.includes('192.168.188.42'));
  assert.ok(requests.every(host => /^192\.168\.188\.(?:[1-9]\d{0,2})$/.test(host)));
  assert.ok(peak <= 12 && peak > 1);
  assert.deepEqual(result, [{ host: '192.168.188.194', model: 'CD-NT670D' }]);
  assert.deepEqual(found, result);
});

test('non-Yamaha, malformed, oversized and redirected responses are ignored', async () => {
  const responses = [
    () => reply({ model_name: 'Printer' }),
    () => reply({ response_code: 1, model_name: 'Yamaha' }),
    () => reply({ response_code: 0, model_name: '' }),
    () => reply({ response_code: 0, model_name: 12 }),
    () => reply(null),
    () => new Response('<html>Router login</html>'),
    () => new Response(JSON.stringify({ response_code: 0, model_name: 'Yamaha' }) + ' '.repeat(16385)),
    () => new Response(JSON.stringify({ response_code: 0, model_name: 'Yamaha' }), { headers: { 'content-length': '20000' } }),
    () => ({ ok: true, redirected: true, headers: new Headers(), text: async () => JSON.stringify({ response_code: 0, model_name: 'Yamaha' }) }),
  ];
  let index = 0;
  const found = [];
  await discoverMusicCast('10.0.0.1', {
    signal: new AbortController().signal, onDevice: device => found.push(device),
    fetcher: async () => responses[index++ % responses.length](),
  });
  assert.deepEqual(found, []);
});

test('invalid or public local addresses cause no requests; a cancelled search never starts', async () => {
  let calls = 0;
  const controller = new AbortController();
  const options = { signal: controller.signal, onDevice: () => assert.fail('No result expected'), fetcher: async () => { calls++; return reply({}); } };
  for (const host of ['8.8.8.8', '127.0.0.1', '0.0.0.0', '192.168.1.255', 'yamaha.local', '192.168.1.1/path']) {
    assert.throws(() => discoveryPrefix(host));
    await assert.rejects(discoverMusicCast(host, options));
  }
  controller.abort();
  assert.deepEqual(await discoverMusicCast('172.16.2.4', options), []);
  assert.equal(calls, 0);
});

test('cancellation aborts outstanding requests, stops the queue and suppresses late results', async () => {
  const controller = new AbortController();
  const signals = [], release = [], found = [];
  const scan = discoverMusicCast('192.168.1.40', {
    signal: controller.signal, onDevice: device => found.push(device),
    fetcher: (_url, init) => {
      signals.push(init.signal);
      // Simulate a transport which still resolves after cancellation.
      return new Promise(resolve => release.push(() => resolve(reply({ response_code: 0, model_name: 'Yamaha' }))));
    },
  });
  assert.equal(signals.length, 12);
  controller.abort();
  assert.ok(signals.every(signal => signal.aborted));
  release.forEach(resolve => resolve());
  assert.deepEqual(await scan, []);
  assert.deepEqual(found, []);
  assert.equal(signals.length, 12);
});

test('probe deadline aborts a stalled request without retrying it', async () => {
  const controller = new AbortController();
  let calls = 0, timedOut = 0;
  await discoverMusicCast('192.168.1.40', {
    signal: controller.signal, onDevice: () => assert.fail('No result expected'),
    fetcher: (_url, init) => {
      calls++;
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => {
        timedOut++;
        controller.abort();
        reject(new Error('aborted'));
      }, { once: true }));
    },
  });
  assert.equal(calls, 12);
  assert.equal(timedOut, 12);
});

test('peer discovery accepts only the probed private origin and a current version/boot descriptor', async () => {
  const found = [];
  const result = await discoverPeers('192.168.1.40', { signal: new AbortController().signal, onDevice: value => found.push(value),
    fetcher: async url => {
      const host = new URL(url).hostname;
      assert.equal(new URL(url).pathname, '/.well-known/mosaicast-peer');
      return reply({ service: 'mosaicast-peer', version: host.endsWith('.2') ? 2 : 1,
        url: host.endsWith('.3') ? 'http://192.168.2.3:8095' : `http://${host}:8095`,
        epoch: host.endsWith('.1') || host.endsWith('.2') || host.endsWith('.3') ? 'a'.repeat(32) : 'invalid' });
    } });
  assert.deepEqual(result, [{url: 'http://192.168.1.1:8095'}]); assert.deepEqual(found, result);
});
