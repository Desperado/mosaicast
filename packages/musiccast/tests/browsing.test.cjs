const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BrowseError, MusicCastClient, demoController } = require('../dist');

// Entirely injected responses: no test contacts Yamaha or a music service.
function fixture() {
  const calls = [];
  const state = { layer: 0, input: 'deezer', power: 'on', title: 'Library', failAction: false, failResult: false, malformed: false, denied: false };
  const fetcher = async (value, init) => {
    const url = new URL(String(value));
    const route = url.pathname.split('/').at(-1);
    calls.push({ route, params: Object.fromEntries(url.searchParams), init, url: String(value) });
    let result = {};
    if (route === 'getFeatures') result = {
      system: { input_list: [{ id: 'deezer', play_info_type: 'netusb' }, { id: 'server', play_info_type: 'netusb' }, { id: 'cd' }] },
      zone: [{ id: 'main', input_list: ['deezer', 'server', 'cd'], func_list: ['power'] }],
    };
    if (route === 'getDeviceInfo') result = { model_name: 'Example' };
    if (route === 'getStatus') result = { power: state.power, input: state.input };
    if (route === 'getListInfo') {
      if (state.failResult && calls.some(call => call.route.startsWith('set'))) throw new TypeError('offline');
      if (state.denied) return new Response(JSON.stringify({ response_code: 112 }));
      const all = state.layer ? Array.from({ length: 11 }, (_, i) => ({ text: `Song ${i}`, attribute: 4 }))
        : [{ text: 'Album', attribute: 6 }, { text: 'Find music', attribute: 10 }, { text: 'Heading', attribute: 0 }];
      const index = Number(url.searchParams.get('index'));
      result = { menu_layer: state.layer, menu_name: state.title, max_line: all.length, index, list_info: state.malformed ? [{ text: 'Bad', attribute: '4' }] : all.slice(index, index + 8) };
    }
    if (route.startsWith('set')) {
      if (state.failAction) throw Object.assign(new Error('timeout'), { name: 'AbortError' });
      if (route === 'setSearchString') state.layer = 1;
      else if (url.searchParams.get('type') === 'select') state.layer = 1;
      else if (url.searchParams.get('type') === 'return') state.layer = 0;
    }
    return new Response(JSON.stringify({ response_code: 0, ...result }));
  };
  return { client: new MusicCastClient('192.168.1.50', fetcher, async () => {}), calls, state, fetcher };
}
const writes = calls => calls.filter(call => call.route.startsWith('set'));
const code = name => error => error instanceof BrowseError && error.code === name;

test('browse reads reported sources and device attributes without writes; unsupported inputs and page offsets are rejected', async () => {
  const { client, calls, state } = fixture();
  const page = await client.browse('deezer');
  assert.deepEqual(page.items.map(({ selectable, playable, searchable }) => [selectable, playable, searchable]), [[true, true, false], [true, false, true], [false, false, false]]);
  assert.deepEqual(calls.find(call => call.route === 'getListInfo').params, { input: 'deezer', list_id: 'main', index: '0', size: '8', lang: 'en' });
  assert.equal(writes(calls).length, 0);
  for (const input of ['cd', 'usb', '../system']) await assert.rejects(client.browse(input), code('browseUnavailable'));
  const count = calls.length;
  for (const index of [-8, 1, 65000, NaN]) await assert.rejects(client.browse('deezer', index), code('browseReadError'));
  assert.equal(calls.length, count);
  state.power = 'standby';
  await assert.rejects(client.browse('deezer'), code('browseUnavailable'));
});

test('folder navigation and paging retain absolute device indexes; playback has an explicit main zone', async () => {
  const { client, calls } = fixture();
  const root = await client.browse('deezer');
  const selected = await client.browseAction({ type: 'select', token: root.token, index: 0 });
  assert.equal(selected.page.layer, 1);
  assert.equal(selected.snapshot, undefined);
  const second = await client.browse('deezer', 8);
  assert.deepEqual(second.items.map(item => item.index), [8, 9, 10]);
  const played = await client.browseAction({ type: 'play', token: second.token, index: 9 });
  assert.equal(played.page.index, 8);
  assert.equal(played.snapshot.status.input, 'deezer');
  assert.deepEqual(writes(calls).at(-1).params, { list_id: 'main', type: 'play', index: '9', zone: 'main' });
  const back = await client.browseAction({ type: 'back', token: played.page.token });
  assert.equal(back.page.layer, 0);
  assert.deepEqual(writes(calls).at(-1).params, { list_id: 'main', type: 'return' });
});

test('search is offered only by a search node and sends UTF-8 text in one JSON POST, never a query string', async () => {
  const { client, calls } = fixture();
  const root = await client.browse('deezer');
  const text = '  Тиха музика & "room"  ';
  const result = await client.browseAction({ type: 'search', token: root.token, index: 1, text });
  assert.equal(result.page.layer, 1);
  assert.equal(writes(calls).length, 1);
  const sent = writes(calls)[0];
  assert.equal(sent.route, 'setSearchString');
  assert.equal(sent.init.method, 'POST');
  assert.deepEqual(JSON.parse(sent.init.body), { list_id: 'main', index: 1, string: text.trim() });
  assert.equal(sent.url.includes('?'), false);
  assert.equal(sent.init.credentials, 'omit');
});

test('another remote changing a shared menu or a replayed token produces no write', async () => {
  const { client, state, calls } = fixture();
  const root = await client.browse('deezer');
  state.title = 'Changed by another remote';
  const action = { type: 'play', token: root.token, index: 0 };
  await assert.rejects(client.browseAction(action), code('browseChanged'));
  await assert.rejects(client.browseAction(action), code('browseChanged'));
  assert.equal(writes(calls).length, 0);
  const updated = await client.browse('deezer');
  await client.browseAction({ ...action, token: updated.token });
  assert.equal(writes(calls).length, 1);
});

test('actions cannot bypass item capabilities, page bounds, root boundaries or search validation', async () => {
  const { client, calls } = fixture();
  for (const action of [{ type: 'play', index: 1 }, { type: 'select', index: 1 }, { type: 'select', index: 2 }, { type: 'play', index: 8 }, { type: 'back' }, { type: 'search', index: 0, text: 'q' }, { type: 'search', index: 1, text: ' ' }, { type: 'search', index: 1, text: 'x\n' }, { type: 'search', index: 1, text: 'x'.repeat(257) }]) {
    const page = await client.browse('deezer');
    await assert.rejects(client.browseAction({ ...action, token: page.token }), code('browseChanged'));
  }
  assert.equal(writes(calls).length, 0);
});

test('timeouts and failed observations after dispatch never retry the action or allow its token to be replayed', async () => {
  for (const failure of ['failAction', 'failResult']) {
    const { client, state, calls } = fixture();
    const page = await client.browse('deezer');
    state[failure] = true;
    const action = { type: 'select', token: page.token, index: 0 };
    await assert.rejects(client.browseAction(action), code('uncertainError'));
    await assert.rejects(client.browseAction(action), code('browseChanged'));
    assert.equal(writes(calls).length, 1);
  }
});

test('malformed and denied menus fail visibly and invalidate previously displayed actions', async () => {
  const { client, state, calls } = fixture();
  const page = await client.browse('deezer');
  state.malformed = true;
  await assert.rejects(client.browse('deezer'), code('browseReadError'));
  await assert.rejects(client.browseAction({ type: 'play', token: page.token, index: 0 }), code('browseChanged'));
  state.denied = true;
  await assert.rejects(client.browse('deezer'), code('browseUnavailable'));
  assert.equal(writes(calls).length, 0);
});

test('slow menu reads use the Yamaha 30-second window and block overlapping status reads and writes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const base = fixture();
  let entered;
  const fetching = new Promise(resolve => { entered = resolve; });
  const client = new MusicCastClient('192.168.1.50', async (url, init) => {
    if (!String(url).includes('getListInfo')) return base.fetcher(url, init);
    entered();
    return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('timeout'), { name: 'AbortError' }))));
  });
  let finished = false;
  const pending = client.browse('deezer').finally(() => { finished = true; });
  await fetching;
  t.mock.timers.tick(30000);
  await Promise.resolve();
  assert.equal(finished, false);
  await assert.rejects(client.read(), /current command or read/);
  await assert.rejects(client.execute({ type: 'power', value: 'standby' }), /current command or read/);
  t.mock.timers.tick(5000);
  await assert.rejects(pending, code('browseReadError'));
  assert.equal(writes(base.calls).length, 0);
});

test('demo catalogs page, search, play and remain isolated between rooms and returned objects', async () => {
  const a = demoController(), b = demoController();
  const root = await a.browse('server');
  root.items[0].text = 'Changed outside controller';
  await a.browseAction({ type: 'select', token: root.token, index: 0 });
  const second = await a.browse('server', 8);
  assert.equal(second.items.length, 3);
  const played = await a.browseAction({ type: 'play', token: second.token, index: 10 });
  assert.equal(played.snapshot.track.title, 'Last light');
  assert.equal((await b.read()).track.title, 'A slower kind of Sunday');
  const back = await a.browseAction({ type: 'back', token: played.page.token });
  const result = await a.browseAction({ type: 'search', token: back.page.token, index: 1, text: 'light' });
  assert.equal(result.page.total, 3);
});
