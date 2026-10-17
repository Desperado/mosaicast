import { parseTunerFeatures } from './tuner';
import type { BluetoothDevice, BluetoothState, Features, Status, Track } from './types';

export function privateIPv4(host: string): boolean {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(host)) return false;
  const [a, b, c, d] = host.split('.').map(Number);
  if ([a, b, c, d].some(part => part > 255) || d === 0 || d === 255) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The Yamaha returned an invalid response.');
  return value as Record<string, unknown>;
}

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 128) : [];
const finite = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const text = (value: unknown): string => typeof value === 'string' ? value.slice(0, 512) : '';
const names: Record<string, string> = { deezer: 'Deezer', spotify: 'Spotify Connect', airplay: 'AirPlay', server: 'PC / NAS', net_radio: 'Internet radio', usb: 'USB', cd: 'CD', tuner: 'FM / DAB', bluetooth: 'Bluetooth', mc_link: 'MusicCast Link', digital: 'Digital input', aux: 'AUX', tidal: 'TIDAL', qobuz: 'Qobuz', napster: 'Napster', juke: 'Juke' };
export const sourceName = (id: string): string => names[id] || id.replaceAll('_', ' ');

export function parseFeatures(data: Record<string, unknown>): Features {
  const system = record(data.system);
  const zone = Array.isArray(data.zone) ? data.zone.map(record).find(item => item.id === 'main') : undefined;
  if (!zone) throw new Error('This Yamaha does not advertise a main zone.');
  const inputs = strings(zone.input_list);
  const sources = (Array.isArray(system.input_list) ? system.input_list : []).map(record)
    .filter(item => typeof item.id === 'string' && /^[a-z][a-z0-9_]{0,47}$/.test(item.id) && inputs.includes(item.id))
    .map(item => ({ id: item.id as string, name: sourceName(item.id as string), networkPlayer: item.play_info_type === 'netusb', tuner: item.play_info_type === 'tuner' }));
  if (!sources.length) throw new Error('This Yamaha does not advertise supported inputs.');
  const range = Array.isArray(zone.range_step) ? zone.range_step.map(record).find(item => item.id === 'volume') : undefined;
  const min = finite(range?.min), max = finite(range?.max), step = finite(range?.step);
  const labels: Record<string, string> = { wired_lan: 'Ethernet', wireless_lan: 'Wi-Fi', wireless_direct: 'Wireless Direct', network_standby: 'Network standby', airplay: 'AirPlay', bluetooth_tx_setting: 'Bluetooth output' };
  return {
    controls: strings(zone.func_list), sources, tuner: parseTunerFeatures(data.tuner),
    connectivity: strings(system.func_list).filter(id => labels[id]).map(id => labels[id]),
    bluetoothOutput: strings(system.func_list).includes('bluetooth_tx_setting'),
    volumeRange: min !== undefined && max !== undefined && step !== undefined && min < max && step > 0 ? { min, max, step } : undefined,
  };
}

export function parseBluetoothDevice(value: unknown): BluetoothDevice {
  const data = record(value);
  if (typeof data.address !== 'string' || !/^[\da-f]{12}$/i.test(data.address)) throw new Error('Invalid Bluetooth address.');
  return {
    address: data.address.toUpperCase(), name: text(data.name).slice(0, 128).trim(),
    type: ['loudspeaker', 'headphone', 'handsfree_device'].includes(String(data.type)) ? data.type as BluetoothDevice['type'] : 'unknown',
  };
}

export function parseBluetoothInfo(data: Record<string, unknown>): BluetoothState {
  if (typeof data.bluetooth_tx_setting !== 'boolean') throw new Error('Bluetooth output status is unavailable.');
  const device = record(data.bluetooth_device);
  if (typeof device.connected !== 'boolean') throw new Error('Bluetooth connection status is unavailable.');
  return { enabled: data.bluetooth_tx_setting, connected: device.connected ? parseBluetoothDevice(device) : undefined, updating: false, devices: [] };
}

export function parseBluetoothList(data: Record<string, unknown>): Pick<BluetoothState, 'updating' | 'devices'> {
  if (typeof data.updating !== 'boolean' || !Array.isArray(data.device_list) || data.device_list.length > 128) throw new Error('Bluetooth device list is unavailable.');
  const devices = data.device_list.map(parseBluetoothDevice);
  return { updating: data.updating, devices: devices.filter((device, index) => devices.findIndex(item => item.address === device.address) === index) };
}

export function parseStatus(data: Record<string, unknown>): Status {
  if (!['on', 'standby'].includes(String(data.power)) || typeof data.input !== 'string') throw new Error('The Yamaha returned an invalid power or input state.');
  return { power: data.power as Status['power'], input: data.input, volume: finite(data.volume), maxVolume: finite(data.max_volume), mute: typeof data.mute === 'boolean' ? data.mute : undefined };
}

export function parseTrack(data: Record<string, unknown>, status: Status, host: string): Track | undefined {
  if (status.power !== 'on' || data.input !== status.input || !text(data.track).trim()) return undefined;
  let artwork: string | undefined;
  if (typeof data.albumart_url === 'string') {
    try {
      const url = new URL(data.albumart_url, `http://${host}`);
      if (url.origin === `http://${host}` && !url.username && !url.password && !url.search && !url.hash && /^\/YamahaRemoteControl\/AlbumART\/[\w-]+\.(jpe?g|png|bmp)$/i.test(url.pathname)) artwork = url.href;
    } catch { /* Missing artwork leaves a local placeholder. */ }
  }
  return { title: text(data.track), artist: text(data.artist), album: text(data.album), playback: ['play', 'pause', 'stop'].includes(String(data.playback)) ? data.playback as Track['playback'] : 'stop', elapsed: finite(data.play_time), duration: finite(data.total_time), artwork };
}
