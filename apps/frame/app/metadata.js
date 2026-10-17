import { privateIPv4 } from './protocol.js';

// Covers are read only from Yamaha's album-art directory, never an arbitrary URL.
export function albumArtPath(host, value) {
  if (!privateIPv4(host) || typeof value !== 'string' || value.length > 256) return '';
  try {
    const url = new URL(value, `http://${host}/`);
    if (url.origin !== `http://${host}` || url.username || url.password || url.search || url.hash) return '';
    return /^\/YamahaRemoteControl\/AlbumART\/[A-Za-z0-9_-]+\.(?:jpe?g|png|bmp)$/i.test(url.pathname) ? url.pathname : '';
  } catch { return ''; }
}

export function artworkUrl(host, info, native, revision) {
  const path = albumArtPath(host, info.albumart_url);
  if (!path) return '';
  const query = new URLSearchParams({ host, path, revision: String(revision) });
  // Yamaha serves artwork only at the exact path it advertises; a query returns 404.
  return native ? `http://${host}${path}` : `/api/artwork?${query}`;
}

export function trackKey(info) {
  return JSON.stringify([info.artist || '', info.track || '', info.album || '', Number(info.total_time) || 0]);
}

const normalizeTrackText = text => typeof text === 'string' ? text.trim().toLowerCase() : '';

export class LyricsLoader {
  constructor(request = (url, options) => globalThis.fetch(url, options), now = Date.now) { this.request = request; this.now = now; this.cache = new Map(); }
  cancel() { this.controller?.abort(); }
  load(info) {
    if (!normalizeTrackText(info.artist) || !normalizeTrackText(info.track)) return Promise.resolve({ state: 'missing' });
    const key = trackKey(info), cached = this.cache.get(key);
    if (cached && cached.expires > this.now()) return cached.promise;
    this.cancel();
    const controller = new AbortController(); this.controller = controller;
    const entry = { expires: Infinity };
    entry.promise = this.lookup(info, controller).then(result => {
      entry.expires = this.now() + (result.state === 'unavailable' ? 60000 : result.state === 'missing' ? 600000 : 86400000);
      return result;
    });
    this.cache.delete(key); this.cache.set(key, entry);
    while (this.cache.size > 20) this.cache.delete(this.cache.keys().next().value);
    return entry.promise;
  }
  async lookup(info, controller) {
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const query = new URLSearchParams({ artist_name: info.artist, track_name: info.track });
      if (info.album) query.set('album_name', info.album);
      if (info.total_time > 0 && info.total_time <= 3600) query.set('duration', String(info.total_time));
      const response = await this.request(`https://lrclib.net/api/get?${query}`, { signal: controller.signal, credentials: 'omit', redirect: 'error' });
      if (response.status === 404) return { state: 'missing' };
      if (!response.ok) return { state: 'unavailable' };
      const data = await response.json();
      // Do not show lyrics for a different recording returned by the provider.
      if (normalizeTrackText(data.artistName) !== normalizeTrackText(info.artist) || normalizeTrackText(data.trackName) !== normalizeTrackText(info.track) ||
          (info.album && normalizeTrackText(data.albumName) !== normalizeTrackText(info.album)) ||
          (info.total_time > 0 && (!Number.isFinite(data.duration) || Math.abs(data.duration - info.total_time) > 2))) return { state: 'missing' };
      if (data.instrumental) return { state: 'instrumental' };
      const text = typeof data.plainLyrics === 'string' && data.plainLyrics.trim() ? data.plainLyrics :
        typeof data.syncedLyrics === 'string' ? data.syncedLyrics.replace(/\[\d+:\d+(?:\.\d+)?\]/g, '').replace(/^\[[a-z]+:.*\]\s*$/gmi, '') : '';
      return text.trim() ? { state: 'found', text: text.trim().slice(0, 50000) } : { state: 'missing' };
    } catch { return { state: 'unavailable' }; }
    finally { clearTimeout(timer); }
  }
}
