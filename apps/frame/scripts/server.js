import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateRequest } from '../app/protocol.js';
import { albumArtPath } from '../app/metadata.js';

// Return only fields the UI needs; account and device identifiers never leave the proxy.
export function publicResponse(route, data, host) {
  const pick = (value, keys) => Object.fromEntries(keys.filter(k => value?.[k] !== undefined).map(k => [k, value[k]]));
  let result = pick(data, ['response_code']);
  if (route === 'system/getDeviceInfo') Object.assign(result, pick(data, ['model_name', 'api_version']));
  if (route === 'system/getFeatures') {
    result.system = { ...pick(data.system, ['func_list']), input_list: (data.system?.input_list || []).map(v => pick(v, ['id', 'play_info_type'])) };
    result.zone = (data.zone || []).map(v => ({ ...pick(v, ['id', 'func_list', 'input_list']), range_step: (v.range_step || []).filter(r => r.id === 'volume').map(r => pick(r, ['id', 'min', 'max', 'step'])) }));
    result.tuner = pick(data.tuner, ['func_list']);
    result.netusb = pick(data.netusb, ['func_list']);
    result.distribution = pick(data.distribution, ['version', 'client_max']);
  }
  if (route === 'main/getStatus') Object.assign(result, pick(data, ['power', 'input', 'volume', 'max_volume', 'mute']));
  if (route === 'netusb/getPlayInfo') Object.assign(result, pick(data, ['input', 'playback', 'artist', 'album', 'track', 'play_time', 'total_time']));
  if (route === 'netusb/getPlayInfo') {
    result.albumart_url = albumArtPath(host, data.albumart_url);
    if (Number.isInteger(data.albumart_id) && data.albumart_id >= 0 && data.albumart_id <= 9999) result.albumart_id = data.albumart_id;
  }
  if (route === 'netusb/getListInfo') {
    Object.assign(result, pick(data, ['input', 'menu_layer', 'menu_name', 'index', 'max_line']));
    result.list_info = (data.list_info || []).map(v => pick(v, ['text', 'attribute']));
  }
  return result;
}

const assets = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/bundle.js': ['bundle.js', 'text/javascript'], '/icon.svg': ['icon.svg', 'image/svg+xml'] };
assets['/themes.css'] = ['themes.css', 'text/css'];
assets['/assets/yamaha.svg'] = ['assets/yamaha.svg', 'image/svg+xml'];
assets['/assets/artist-orbits.svg'] = ['assets/artist-orbits.svg', 'image/svg+xml'];
for (const font of ['Caprasimo', 'Figtree', 'InstrumentSerif', 'InstrumentSans', 'Archivo', 'IBMPlexSans', 'IBMPlexMono']) {
  assets[`/fonts/${font}.ttf`] = [`fonts/${font}.ttf`, 'font/ttf'];
}

export function createServer(upstream = fetch) {
  return http.createServer(async (req, res) => {
    const reply = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    const expectedHost = `127.0.0.1:${req.socket.localPort}`;
    // Local preview only, including protection against DNS rebinding/cross-site control.
    if (![expectedHost, `localhost:${req.socket.localPort}`].includes(req.headers.host) || (req.headers.origin && ![`http://${expectedHost}`, `http://localhost:${req.socket.localPort}`].includes(req.headers.origin)) || req.headers['sec-fetch-site'] === 'cross-site') return reply(403, { error: 'Local requests only.' });
    try {
      if (req.url.startsWith('/api/artwork?') && req.method === 'GET') {
        const query = new URL(req.url, 'http://localhost').searchParams;
        const host = query.get('host'), path = albumArtPath(host, query.get('path'));
        if (!path || [...query.keys()].some(key => !['host', 'path', 'revision'].includes(key)) || !/^\d{1,16}$/.test(query.get('revision') || '')) return reply(400, { error: 'Invalid artwork request.' });
        const response = await upstream(`http://${host}${path}`, { signal: AbortSignal.timeout(8000), redirect: 'error', credentials: 'omit' });
        const type = response.headers.get('content-type')?.split(';')[0].toLowerCase();
        if (!response.ok || !['image/jpeg', 'image/png', 'image/bmp'].includes(type)) return reply(502, { error: 'Artwork unavailable.' });
        let size = 0; const chunks = [];
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 5242880) throw new Error('Artwork too large.');
          chunks.push(Buffer.from(chunk));
        }
        res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
        return res.end(Buffer.concat(chunks));
      }
      if (req.url === '/api/musiccast' && req.method === 'POST') {
        if (!req.headers['content-type']?.startsWith('application/json')) return reply(415, { error: 'JSON required.' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 4096) return reply(413, { error: 'Request too large.' });
        }
        let payload;
        try { payload = JSON.parse(body); validateRequest(payload.host, payload.route, payload.params); }
        catch { return reply(400, { error: 'Invalid request.' }); }
        const spec = validateRequest(payload.host, payload.route, payload.params);
        const response = await upstream(spec.url, { method: spec.method, body: spec.body, headers: spec.body ? { 'Content-Type': 'application/json' } : {}, signal: AbortSignal.timeout(35000), redirect: 'error' });
        if (!response.ok) return reply(502, { error: 'Device unavailable.' });
        // Bound response size even for hosts that are not actually Yamahas.
        let size = 0;
        const chunks = [];
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 131072) throw new Error('Response too large.');
          chunks.push(Buffer.from(chunk));
        }
        return reply(200, publicResponse(payload.route, JSON.parse(Buffer.concat(chunks).toString('utf8')), payload.host));
      }
      if (req.method === 'GET' && req.url === '/$WEBAPIS/webapis/webapis.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); res.end(''); return; }
      if (req.method !== 'GET' || !Object.hasOwn(assets, req.url)) return reply(404, { error: 'Not found.' });
      const [name, type] = assets[req.url];
      const content = await readFile(new URL(`../app/${name}`, import.meta.url));
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; connect-src 'self' https://lrclib.net https://*:8093 http://*:8095; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", 'Cache-Control': 'no-store' });
      res.end(content);
    } catch { reply(502, { error: 'Device unavailable.' }); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(4173, '127.0.0.1', () => console.log('Frame Music → http://127.0.0.1:4173'));
}
