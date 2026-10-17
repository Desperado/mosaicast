import test from 'node:test';
import assert from 'node:assert/strict';
import { albumArtPath, artworkUrl, LyricsLoader } from '../app/metadata.js';

const info = { artist: 'Example artist', track: 'Example song', album: 'Example album', total_time: 180 };
const record = { artistName: info.artist, trackName: info.track, albumName: info.album, duration: 180, plainLyrics: 'Original fixture words\nFor this test only' };
const response = data => ({ ok: true, status: 200, json: async () => data });

test('covers accept only the connected Yamaha album-art directory', () => {
  const path = '/YamahaRemoteControl/AlbumART/AlbumART9171.jpg';
  for (const value of [path, path.slice(1), `http://192.168.1.20${path}`]) assert.equal(albumArtPath('192.168.1.20', value), path);
  for (const value of [`http://10.0.0.2${path}`, `https://192.168.1.20${path}`, `http://user:fixture@192.168.1.20${path}`, `${path}?account=fixture`, `${path}#fragment`, '/YamahaExtendedControl/v1/main/setPower', '/YamahaRemoteControl/AlbumART/../../main/setPower', '/YamahaRemoteControl/AlbumART/a.svg', '/YamahaRemoteControl/AlbumART/a.ymf', 'data:image/png;base64,fixture']) assert.equal(albumArtPath('192.168.1.20', value), '');
  assert.equal(albumArtPath('169.254.169.254', path), '');
  const url = new URL(artworkUrl('192.168.1.20', { albumart_url: path }, false, 2), 'http://localhost');
  assert.equal(url.pathname, '/api/artwork'); assert.equal(url.searchParams.get('path'), path);
});

test('TV covers use the exact Yamaha URL without proxy cache parameters', () => {
  const host = '192.168.1.20';
  for (const id of [9219, 9220]) {
    const path = `/YamahaRemoteControl/AlbumART/AlbumART${id}.jpg`;
    for (const value of [path, `http://${host}${path}`]) {
      assert.equal(artworkUrl(host, {albumart_url: value, albumart_id: id}, true, id), `http://${host}${path}`);
    }
  }
});

test('lyrics lookup uses recording metadata, omits credentials and deduplicates pending and cached requests', async () => {
  let count = 0, release;
  const loader = new LyricsLoader(async (url, options) => {
    count++; const query = new URL(url).searchParams;
    assert.equal(query.get('artist_name'), info.artist); assert.equal(query.get('track_name'), info.track);
    assert.equal(query.get('album_name'), info.album); assert.equal(query.get('duration'), '180');
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    await new Promise(resolve => { release = resolve; }); return response(record);
  });
  const first = loader.load(info), second = loader.load(info);
  assert.equal(first, second); assert.equal(count, 1); release();
  assert.deepEqual(await first, { state: 'found', text: record.plainLyrics });
  assert.deepEqual(await loader.load(info), { state: 'found', text: record.plainLyrics }); assert.equal(count, 1);
});

test('lyrics reject a different artist, song, album or recording duration', async () => {
  for (const mismatch of [{ artistName: 'Another artist' }, { trackName: 'Another song' }, { albumName: 'Another album' }, { duration: 183 }, { duration: undefined }]) {
    const loader = new LyricsLoader(async () => response({ ...record, ...mismatch }));
    assert.deepEqual(await loader.load(info), { state: 'missing' });
  }
});

test('the default lyrics request preserves the browser fetch receiver', async t => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async function () {
    assert.equal(this, globalThis, 'Safari requires fetch to be called on its global object');
    return response(record);
  };
  assert.deepEqual(await new LyricsLoader().load(info), {state: 'found', text: record.plainLyrics});
});

test('missing, offline and instrumental lyrics are normal states; synced-only lyrics lose timestamps', async () => {
  for (const [request, expected] of [
    [async () => ({status: 404, ok: false}), { state: 'missing' }],
    [async () => ({status: 429, ok: false}), { state: 'unavailable' }],
    [async () => { throw new TypeError('Offline'); }, { state: 'unavailable' }],
    [async () => response({...record, instrumental: true}), { state: 'instrumental' }],
    [async () => response({...record, plainLyrics: null, syncedLyrics: '[ar:Example artist]\n[00:01.23]Original fixture words\n[01:02.34]For this test only'}), {state: 'found', text: record.plainLyrics}]
  ]) assert.deepEqual(await new LyricsLoader(request).load(info), expected);
  let count = 0;
  const loader = new LyricsLoader(async () => { count++; return response(record); });
  assert.deepEqual(await loader.load({track: info.track}), {state: 'missing'}); assert.equal(count, 0);
});

test('lyrics failures retry after a minute and cache stays bounded', async () => {
  let now = 0, count = 0;
  const loader = new LyricsLoader(async () => {count++; return {status: 503, ok: false};}, () => now);
  await loader.load(info); now = 59999; await loader.load(info); assert.equal(count, 1);
  now = 60000; await loader.load(info); assert.equal(count, 2);
  for (let i = 0; i < 25; i++) await loader.load({...info, track: `Fixture ${i}`});
  assert.equal(loader.cache.size, 20);
});

test('changing the recording cancels the previous lyrics request', async () => {
  let signals = [];
  const loader = new LyricsLoader(async (_url, { signal }) => {
    signals.push(signal);
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Cancelled'))));
  });
  const first = loader.load(info), second = loader.load({...info, track: 'Next song'});
  assert.equal(signals[0].aborted, true); assert.equal(signals[1].aborted, false);
  loader.cancel();
  assert.deepEqual(await first, {state: 'unavailable'}); assert.deepEqual(await second, {state: 'unavailable'});
});
