import { parseFeatures, parseStatus, parseTrack, privateIPv4, record } from './parsers';
import type { Command, Controller, Features, Snapshot, Status } from './types';

type Fetch = typeof globalThis.fetch;
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class MusicCastClient implements Controller {
  readonly mode = 'device' as const;
  private features?: Features;
  private model = 'Yamaha';
  private writing = false;

  constructor(readonly host: string, private readonly fetcher: Fetch = (url, options) => globalThis.fetch(url, options), private readonly delay = wait) {
    if (!privateIPv4(host)) throw new Error('Enter a private IPv4 address, such as 192.168.1.50.');
  }

  private async request(route: string, params: Record<string, string> = {}): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const query = new URLSearchParams(params).toString();
      const response = await this.fetcher(`http://${this.host}/YamahaExtendedControl/v1/${route}${query ? `?${query}` : ''}`, { signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error('The Yamaha could not complete this request.');
      const data = record(await response.json());
      if (data.response_code !== 0) throw new Error(`MusicCast reported error ${typeof data.response_code === 'number' ? data.response_code : 'unknown'}.`);
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('The Yamaha timed out. Check Wi-Fi and Network Standby.');
      if (error instanceof TypeError) throw new Error('The Yamaha could not be reached. Check its address, Wi-Fi and local-network permission.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  private async capabilities(): Promise<Features> {
    this.features = parseFeatures(await this.request('system/getFeatures'));
    return this.features;
  }

  async read(): Promise<Snapshot> {
    if (!this.features) {
      const device = await this.request('system/getDeviceInfo');
      this.model = typeof device.model_name === 'string' ? device.model_name.slice(0, 80) : 'Yamaha';
      await this.capabilities();
    }
    return this.snapshot(parseStatus(await this.request('main/getStatus')));
  }

  private async snapshot(status: Status): Promise<Snapshot> {
    const features = this.features!;
    let track: Snapshot['track'], trackUnavailable = false;
    if (status.power === 'on' && features.sources.some(source => source.id === status.input && source.networkPlayer)) {
      try { track = parseTrack(await this.request('netusb/getPlayInfo'), status, this.host); }
      catch { trackUnavailable = true; }
    }
    return { model: this.model, features, status, track, trackUnavailable };
  }

  async execute(command: Command): Promise<Snapshot> {
    if (this.writing) throw new Error('Wait for the current command to finish.');
    this.writing = true;
    try {
      if (!this.features) await this.read();
      const features = command.type === 'input' ? await this.capabilities() : this.features!;
      const status = parseStatus(await this.request('main/getStatus'));
      let route: string, params: Record<string, string>, confirms: ((value: Status) => boolean) | undefined;
      if (command.type === 'playback') {
        if (status.power !== 'on' || !features.sources.some(source => source.id === status.input && source.networkPlayer)) throw new Error('Playback controls are available for powered-on network / USB sources only.');
        route = 'netusb/setPlayback'; params = { playback: command.value };
      } else {
        const capability = command.type === 'input' ? 'input' : command.type;
        if (capability !== 'input' && !features.controls.includes(capability)) throw new Error('This Yamaha does not support that control.');
        switch (command.type) {
          case 'power':
            if (status.power === command.value) return this.snapshot(status);
            route = 'main/setPower'; params = { power: command.value }; confirms = value => value.power === command.value;
            break;
          case 'input':
            if (!features.sources.some(source => source.id === command.value)) throw new Error('This source is no longer available.');
            if (status.input === command.value) return this.snapshot(status);
            route = 'main/setInput'; params = { input: command.value, mode: 'autoplay_disabled' }; confirms = value => value.input === command.value;
            break;
          case 'mute':
            if (typeof status.mute !== 'boolean') throw new Error('Mute state is unavailable. Refresh before trying again.');
            if (status.mute === command.value) return this.snapshot(status);
            route = 'main/setMute'; params = { enable: String(command.value) }; confirms = value => value.mute === command.value;
            break;
          case 'volume': {
            const range = features.volumeRange;
            if (status.power !== 'on' || status.volume === undefined || !range) throw new Error('Volume controls are unavailable for this state.');
            const max = Math.min(range.max, status.maxVolume ?? range.max);
            const target = Math.max(range.min, Math.min(max, status.volume + (command.value === 'up' ? range.step : -range.step)));
            if (target === status.volume) return this.snapshot(status);
            route = 'main/setVolume'; params = { volume: command.value }; confirms = value => value.volume === target;
            break;
          }
        }
      }
      // Send each write once: a timeout can mean it reached the device already.
      try {
        await this.request(route, params);
        for (let attempt = 0; attempt < 4; attempt++) {
          if (attempt) await this.delay(200 * attempt);
          const updated = parseStatus(await this.request('main/getStatus'));
          if (!confirms || confirms(updated)) {
            const snapshot = await this.snapshot(updated);
            if (command.type !== 'playback' || !['play', 'pause'].includes(command.value) || snapshot.track?.playback === command.value) return snapshot;
          }
        }
      } catch (error) {
        throw new Error(`${error instanceof Error ? error.message : 'Command failed.'} Its result is uncertain; refresh before trying again.`);
      }
      throw new Error('The Yamaha did not confirm the change. Refresh before trying again.');
    } finally { this.writing = false; }
  }
}
