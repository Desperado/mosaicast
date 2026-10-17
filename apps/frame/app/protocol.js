// Only local MusicCast endpoints used by this app. No account/login APIs.
export function privateIPv4(host) {
  if (typeof host !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split('.');
  if (parts.some(p => String(Number(p)) !== p || Number(p) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

const input = v => typeof v === 'string' && /^[a-z][a-z0-9_]{0,31}$/.test(v);
const index = v => Number.isInteger(v) && v >= 0 && v <= 64999;
const oneOf = values => v => values.includes(v);
const routes = {
  'system/getDeviceInfo': {},
  'system/getFeatures': {},
  'main/getStatus': {},
  'main/setPower': { power: oneOf(['on', 'standby']) },
  'main/setInput': { input, mode: v => v === 'autoplay_disabled' },
  'main/setVolume': { volume: oneOf(['up', 'down']) },
  'main/setMute': { enable: v => typeof v === 'boolean' },
  'netusb/getPlayInfo': {},
  'main/prepareInputChange': { input },
  'netusb/getListInfo': { input, index: v => index(v) && v % 8 === 0, size: v => v === 8, lang: v => v === 'en', list_id: v => v === 'main' },
  'netusb/setListControl': { list_id: v => v === 'main', type: oneOf(['select', 'play', 'return']), index, zone: v => v === 'main' },
  'netusb/setSearchString': { list_id: v => v === 'main', index, string: v => typeof v === 'string' && v.trim().length > 0 && v.length <= 128 },
  'netusb/setPlayback': { playback: oneOf(['play', 'pause', 'play_pause', 'previous', 'next', 'stop']) }
};

export function validateRequest(host, route, params = {}) {
  if (!privateIPv4(host)) throw new Error('Enter a private IPv4 address, such as 192.168.1.20.');
  if (!Object.prototype.hasOwnProperty.call(routes, route) || !params || typeof params !== 'object' || Array.isArray(params)) throw new Error('Unsupported MusicCast request.');
  const schema = routes[route];
  const required = Object.keys(schema).filter(k => !(route === 'netusb/setListControl' && params.type === 'return' && k === 'index'));
  if (Object.keys(params).some(k => !Object.prototype.hasOwnProperty.call(schema, k) || !schema[k](params[k])) || required.some(k => !Object.prototype.hasOwnProperty.call(params, k))) throw new Error('Invalid MusicCast parameters.');
  const method = route === 'netusb/setSearchString' ? 'POST' : 'GET';
  const query = method === 'GET' ? new URLSearchParams(params).toString() : '';
  return { url: `http://${host}/YamahaExtendedControl/v1/${route}${query ? '?' + query : ''}`, method, body: method === 'POST' ? JSON.stringify(params) : undefined };
}

export const capabilities = attribute => ({
  browse: Boolean(Number(attribute) & 2), play: Boolean(Number(attribute) & 4), search: Boolean(Number(attribute) & 8)
});

export function entries(list) {
  return (list.list_info || []).map((item, i) => ({ ...item, index: Number(list.index || 0) + i, ...capabilities(item.attribute) }));
}

const sourceNames = { napster: 'Napster', spotify: 'Spotify Connect', juke: 'Juke', qobuz: 'Qobuz', tidal: 'TIDAL', deezer: 'Deezer', airplay: 'AirPlay', mc_link: 'MusicCast Link', server: 'PC / NAS', net_radio: 'Internet radio', bluetooth: 'Bluetooth', usb: 'USB', tuner: 'FM / DAB radio', cd: 'CD', digital: 'Optical input', aux: 'AUX' };
const browsable = ['napster', 'juke', 'qobuz', 'tidal', 'deezer', 'server', 'net_radio', 'usb'];
export const sourceName = id => sourceNames[id] || String(id || 'Yamaha').replaceAll('_', ' ');

export function sources(features) {
  const main = features.zone?.find(zone => zone.id === 'main');
  return (features.system?.input_list || []).filter(source => input(source.id) && main?.input_list?.includes(source.id)).map(source => ({
    id: source.id, name: sourceName(source.id), type: source.play_info_type || 'none', browse: source.play_info_type === 'netusb' && browsable.includes(source.id),
    description: ['airplay', 'spotify'].includes(source.id) ? 'Send music from your phone or laptop' : source.id === 'bluetooth' ? 'Pair using MusicCast or the Yamaha remote' : source.id === 'mc_link' ? 'Set up rooms in MusicCast' : ['cd', 'tuner'].includes(source.id) ? 'Playback controls on the Yamaha remote' : ['digital', 'aux'].includes(source.id) ? 'Audio from a connected external device' : browsable.includes(source.id) ? 'Browse the Yamaha’s music menu' : 'Source controls through MusicCast or the Yamaha remote'
  }));
}

export function deviceCapabilities(features) {
  const system = features.system?.func_list || [], main = features.zone?.find(zone => zone.id === 'main')?.func_list || [];
  const labels = { wired_lan: 'Ethernet', wireless_lan: 'Wi-Fi', wireless_direct: 'Wireless Direct', airplay: 'AirPlay', bluetooth_tx_setting: 'Bluetooth output', network_standby: 'Network standby', auto_power_standby: 'Automatic standby' };
  const result = Object.keys(labels).filter(id => system.includes(id)).map(id => labels[id]);
  for (const [id, label] of [['power', 'Power control'], ['sleep', 'Sleep timer'], ['volume', 'Volume'], ['mute', 'Mute'], ['link_control', 'MusicCast linking'], ['link_audio_quality', 'Link audio quality']]) if (main.includes(id)) result.push(label);
  if (sources(features).some(source => source.id === 'bluetooth')) result.push('Bluetooth input');
  for (const [id, label] of [['recent_info', 'Recent listening'], ['play_queue', 'Play queue'], ['mc_playlist', 'MusicCast playlists']]) if (features.netusb?.func_list?.includes(id)) result.push(label);
  if (features.tuner?.func_list?.includes('fm')) result.push('FM radio');
  if (features.tuner?.func_list?.includes('dab')) result.push('DAB radio');
  if (Number.isInteger(features.distribution?.client_max) && features.distribution.client_max > 0) result.push(`Multiroom: up to ${features.distribution.client_max} clients`);
  return result;
}

export function soundControls(features, status) {
  const zone = features.zone?.find(z => z.id === 'main');
  const range = zone?.range_step?.find(r => r.id === 'volume');
  const volume = Number.isFinite(status.volume) ? status.volume : undefined;
  const min = Number.isFinite(range?.min) ? range.min : undefined;
  const limits = [range?.max, status.max_volume].filter(Number.isFinite);
  const max = limits.length ? Math.min(...limits) : undefined;
  const supported = zone?.func_list?.includes('volume') && volume !== undefined;
  return {
    label: volume === undefined ? 'Volume unavailable' : `Volume ${volume}${max === undefined ? '' : ` / ${max}`}`,
    down: Boolean(supported && (min === undefined || volume > min)),
    up: Boolean(supported && (max === undefined || volume < max)),
    canMute: Boolean(zone?.func_list?.includes('mute') && typeof status.mute === 'boolean'),
    muted: status.mute === true
  };
}

export class MusicCast {
  constructor(host, transport) {
    this.host = host;
    this.transport = transport;
    this.tail = Promise.resolve();
    this.pending = 0;
  }
  request(route, params = {}) {
    validateRequest(this.host, route, params);
    this.pending++;
    const task = this.tail.then(async () => {
      const data = await this.transport(this.host, route, params);
      if (data.response_code !== 0) {
        const messages = { 5: 'The Yamaha is not ready for this operation.', 6: 'The Yamaha timed out.', 100: 'The music service could not be reached.', 104: 'Check your subscription in MusicCast.', 105: 'Reconnect the music service in the MusicCast phone app.' };
        throw new Error(messages[data.response_code] || `MusicCast returned error ${Number(data.response_code)}.`);
      }
      return data;
    });
    this.tail = task.catch(() => {}).finally(() => { this.pending--; });
    return task;
  }
  list(index = 0, source = 'deezer') {
    return this.request('netusb/getListInfo', { input: source, index, size: 8, lang: 'en', list_id: 'main' });
  }
  async selectInput(source) {
    const features = await this.request('system/getFeatures');
    if (!sources(features).some(item => item.id === source)) throw new Error('This Yamaha no longer advertises that input. Refresh Sources.');
    await this.request('main/setInput', { input: source, mode: 'autoplay_disabled' });
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
      const status = await this.request('main/getStatus');
      if (status.input === source) return status;
    }
    throw new Error('The Yamaha has not confirmed the input change yet. Refresh Sources to check its state.');
  }
  async power(target) {
    if (!['on', 'standby'].includes(target)) throw new Error('Unsupported power command.');
    const features = await this.request('system/getFeatures');
    if (!features.zone?.find(zone => zone.id === 'main')?.func_list?.includes('power')) throw new Error('This Yamaha does not advertise power control.');
    const before = await this.request('main/getStatus');
    if (before.power === target) return before;
    await this.request('main/setPower', { power: target });
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
      const status = await this.request('main/getStatus');
      if (status.power === target) return status;
    }
    throw new Error('The Yamaha has not confirmed the power change yet. Refresh to check its state.');
  }
  control(type, index) {
    return this.request('netusb/setListControl', { list_id: 'main', type, ...(type === 'return' ? {} : { index }), zone: 'main' });
  }
  search(index, string) {
    return this.request('netusb/setSearchString', { list_id: 'main', index, string: string.trim() });
  }
  async sound(command, features) {
    if (!['mute', 'up', 'down'].includes(command)) throw new Error('Unsupported sound command.');
    const before = await this.request('main/getStatus');
    const controls = soundControls(features, before);
    if (command === 'mute' && controls.canMute) await this.request('main/setMute', { enable: !controls.muted });
    else if ((command === 'up' && controls.up) || (command === 'down' && controls.down)) await this.request('main/setVolume', { volume: command });
    else return before;
    // A successful command response can precede the updated device status.
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 250 * attempt));
      const status = await this.request('main/getStatus');
      if (command === 'mute' ? status.mute === !controls.muted : command === 'up' ? status.volume > before.volume : status.volume < before.volume) return status;
    }
    throw new Error('The Yamaha has not confirmed the sound change yet. Its status will refresh automatically.');
  }
}

export async function transport(host, route, params) {
  const request = validateRequest(host, route, params);
  const native = Boolean(globalThis.tizen?.application);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 36000);
  try {
    const response = await fetch(native ? request.url : '/api/musiccast', {
      method: native ? request.method : 'POST',
      headers: !native || request.body ? { 'Content-Type': 'application/json' } : {},
      body: native ? request.body : JSON.stringify({ host, route, params }),
      signal: controller.signal, redirect: 'error', credentials: 'omit'
    });
    if (!response.ok) {
      if (!native && [400, 404].includes(response.status)) throw new Error('The local server does not support this request. Restart npm start, then reload the app.');
      if (!native && response.status === 403) throw new Error('The local server rejected access. Open the app at http://127.0.0.1:4173.');
      throw new Error('The Yamaha could not be reached. Check its IP address and network.');
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The Yamaha took too long to respond. Try again.');
    if (error instanceof TypeError) throw new Error('Connection failed. Check that both devices are on the same network.');
    throw error;
  } finally { clearTimeout(timeout); }
}
