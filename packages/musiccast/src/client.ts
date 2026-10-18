import { parsePresets, parseTuner } from './tuner';
import { CommandRejectedError } from './command-error';
import { parseBluetoothInfo, parseBluetoothList, parseFeatures, parseStatus, parseTrack, privateIPv4, record } from './parsers';
import { BrowseError, canBrowseSource, parseBrowsePage, sameBrowsePage, validBrowseAction, validBrowseIndex } from './browsing';
import type { BluetoothCommand, BluetoothState, BrowseAction, BrowsePage, BrowseResult, Command, Controller, Features, Snapshot, Status } from './types';

type Fetch = typeof globalThis.fetch;
type Write = (route: string, params: Record<string, string>, timeout?: number) => Promise<unknown>;
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class MusicCastClient implements Controller {
  readonly mode = 'device' as const;
  private features?: Features;
  private model = 'Yamaha';
  private operating = false;
  private page?: BrowsePage;
  private revision = 0;

  constructor(readonly host: string, private readonly fetcher: Fetch = (url, options) => globalThis.fetch(url, options), private readonly delay = wait) {
    if (!privateIPv4(host)) throw new Error('Enter a private IPv4 address, such as 192.168.1.50.');
  }

  private async request(route: string, params: Record<string, string> = {}, options: { timeout?: number; body?: Record<string, unknown> } = {}): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout ?? 5000);
    try {
      const query = new URLSearchParams(params).toString();
      const response = await this.fetcher(`http://${this.host}/YamahaExtendedControl/v1/${route}${query ? `?${query}` : ''}`, {
        signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
        ...(options.body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body) } : {}),
      });
      if (!response.ok) throw new Error('The Yamaha could not complete this request.');
      const data = record(await response.json());
      if (data.response_code !== 0) {
        if (route === 'netusb/getListInfo') throw new BrowseError('browseUnavailable');
        throw new Error(`MusicCast reported error ${typeof data.response_code === 'number' ? data.response_code : 'unknown'}.`);
      }
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

  private async operation<T>(run: () => Promise<T>): Promise<T> {
    if (this.operating) throw new Error('Wait for the current command or read to finish.');
    this.operating = true;
    try { return await run(); }
    finally { this.operating = false; }
  }

  read(): Promise<Snapshot> { return this.operation(() => this.readSnapshot()); }

  private async readSnapshot(): Promise<Snapshot> {
    if (!this.features) {
      const device = await this.request('system/getDeviceInfo');
      this.model = typeof device.model_name === 'string' ? device.model_name.slice(0, 80) : 'Yamaha';
      await this.capabilities();
    }
    return this.snapshot(parseStatus(await this.request('main/getStatus')));
  }

  private async readBluetooth(): Promise<BluetoothState> {
    const bluetooth = parseBluetoothInfo(await this.request('system/getBluetoothInfo'));
    return bluetooth.enabled ? { ...bluetooth, ...parseBluetoothList(await this.request('system/getBluetoothDeviceList')) } : bluetooth;
  }

  private async snapshot(status: Status, bluetooth?: BluetoothState): Promise<Snapshot> {
    const features = this.features!;
    let track: Snapshot['track'], trackUnavailable = false;
    if (status.power === 'on' && features.sources.some(source => source.id === status.input && source.networkPlayer)) {
      try { track = parseTrack(await this.request('netusb/getPlayInfo'), status, this.host); }
      catch { trackUnavailable = true; }
    }
    let tuner: Snapshot['tuner'];
    if (status.power === 'on' && features.tuner && features.sources.some(source => source.id === status.input && source.tuner)) {
      try { tuner = parseTuner(await this.request('tuner/getPlayInfo'), features.tuner); }
      catch { /* Status and volume remain usable when tuner metadata is unavailable. */ }
      if (tuner && features.tuner.presets) {
        try { tuner.presets = parsePresets(await this.request('tuner/getPresetInfo', { band: features.tuner.presets.type === 'common' ? 'common' : tuner.band }), features.tuner); }
        catch { /* Keep tuning available; unavailable presets are not offered. */ }
      }
    }
    if (features.bluetoothOutput && status.power === 'on' && !bluetooth) {
      try { bluetooth = await this.readBluetooth(); }
      catch { /* Optional Bluetooth failures must not disable the main player. */ }
    }
    return { model: this.model, features, status, track, trackUnavailable, tuner, bluetooth };
  }

  execute(command: Command): Promise<Snapshot> {
    return this.operation(async () => {
      let dispatched = false;
      const write: Write = (route, params, timeout) => { dispatched = true; return this.request(route, params, timeout ? { timeout } : {}); };
      try { return await this.performCommand(command, write); }
      catch (error) { if (!dispatched) throw new CommandRejectedError(error instanceof Error ? error.message : undefined); throw error; }
    });
  }

  private async performCommand(command: Command, write: Write): Promise<Snapshot> {
    if (!this.features) await this.readSnapshot();
    if (command.type === 'tunerBand' || command.type === 'tunerTune' || command.type === 'tunerService' || command.type === 'tunerPreset' || command.type === 'tunerScan') return this.performTunerCommand(command, write);
    if (command.type === 'bluetoothOutput' || command.type === 'bluetoothScan' || command.type === 'bluetoothConnect' || command.type === 'bluetoothDisconnect') return this.performBluetoothCommand(command, write);
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
      await write(route, params);
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt) await this.delay(200 * attempt);
        let updated: Status;
        try { updated = parseStatus(await this.request('main/getStatus')); }
        catch (error) {
          // Only retry confirmation reads after an acknowledged write. The
          // write above is sent once, even if every status reply is lost.
          if (attempt === 3) throw error;
          continue;
        }
        if (!confirms || confirms(updated)) {
          const snapshot = await this.snapshot(updated);
          if (command.type !== 'playback' || !['play', 'pause'].includes(command.value) || snapshot.track?.playback === command.value) return snapshot;
        }
      }
    } catch (error) {
      throw new Error(`${error instanceof Error ? error.message : 'Command failed.'} Its result is uncertain; refresh before trying again.`);
    }
    throw new Error('The Yamaha did not confirm the change. Refresh before trying again.');
  }

  private async performBluetoothCommand(command: BluetoothCommand, write: Write): Promise<Snapshot> {
    const features = await this.capabilities();
    const status = parseStatus(await this.request('main/getStatus'));
    if (!features.bluetoothOutput) throw new Error('This Yamaha does not support Bluetooth output.');
    if (status.power !== 'on') throw new Error('Power on the Yamaha before using Bluetooth output.');
    const before = await this.readBluetooth();
    if (command.type !== 'bluetoothOutput' && !before.enabled) throw new Error('Enable Bluetooth output first.');
    if (status.input === 'bluetooth' && !(command.type === 'bluetoothOutput' && !command.value) && command.type !== 'bluetoothDisconnect') throw new Error('Choose another input before using Bluetooth output.');
    let route: string, params: Record<string, string> = {};
    let confirms: (state: BluetoothState) => boolean;
    switch (command.type) {
      case 'bluetoothOutput':
        if (before.enabled === command.value) return this.snapshot(status, before);
        route = 'system/setBluetoothTxSetting'; params = { enable: String(command.value) };
        confirms = state => state.enabled === command.value;
        break;
      case 'bluetoothScan':
        if (before.updating) throw new Error('Wait for the Bluetooth search to finish.');
        route = 'system/updateBluetoothDeviceList'; confirms = () => true;
        break;
      case 'bluetoothConnect': {
        if (!/^[\da-f]{12}$/i.test(command.value)) throw new Error('Invalid Bluetooth address.');
        const address = command.value.toUpperCase();
        if (before.connected?.address === address) return this.snapshot(status, before);
        if (before.updating) throw new Error('Wait for the Bluetooth search to finish.');
        if (!before.devices.some(device => device.address === address)) throw new Error('Search again; this Bluetooth device is no longer available.');
        route = 'system/connectBluetoothDevice'; params = { address };
        confirms = state => state.connected?.address === address;
        break;
      }
      case 'bluetoothDisconnect':
        if (!before.connected) return this.snapshot(status, before);
        route = 'system/disconnectBluetoothDevice'; confirms = state => !state.connected;
        break;
    }
    try {
      // Bluetooth connection can take longer than an ordinary status request.
      // Dispatch once; only the observation reads below may be repeated.
      await write(route, params, command.type === 'bluetoothConnect' ? 20000 : undefined);
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt) await this.delay(500 * attempt);
        const bluetooth = await this.readBluetooth();
        if (confirms(bluetooth)) return this.snapshot(status, bluetooth);
      }
    } catch {
      throw new Error('Bluetooth command result is uncertain; refresh before trying again.');
    }
    throw new Error('The Yamaha did not confirm the Bluetooth change. Refresh before trying again.');
  }

  private async performTunerCommand(command: Extract<Command, { type: 'tunerBand' | 'tunerTune' | 'tunerService' | 'tunerPreset' | 'tunerScan' }>, write: Write): Promise<Snapshot> {
    const features = await this.capabilities();
    const status = parseStatus(await this.request('main/getStatus'));
    if (status.power !== 'on' || !features.tuner || !features.sources.some(source => source.id === status.input && source.tuner)) throw new Error('Tuner controls are unavailable for this source.');
    const info = parseTuner(await this.request('tuner/getPlayInfo'), features.tuner);
    let route: string, params: Record<string, string>;
    if (command.type === 'tunerBand') {
      if (!features.tuner.bands.includes(command.value)) throw new Error('This radio band is unavailable.');
      if (info?.band === command.value) return this.snapshot(status);
      route = 'tuner/setBand'; params = { band: command.value };
    } else {
      if (!info) throw new Error('Refresh tuner information before tuning.');
      if (command.type === 'tunerTune') {
        const range = features.tuner.fmRange;
        if (info.band !== 'fm' || !range || info.frequency === undefined || info.frequency < range.min || info.frequency > range.max || !['up', 'down', 'auto_up', 'auto_down'].includes(command.value)) throw new Error('FM tuning is unavailable.');
        route = 'tuner/setFreq'; params = { band: 'fm', tuning: command.value };
      } else if (command.type === 'tunerService') {
        if (info.band !== 'dab' || !info.ready || !['previous', 'next'].includes(command.value)) throw new Error('DAB stations are not ready.');
        route = 'tuner/setDabService'; params = { dir: command.value };
      } else if (command.type === 'tunerScan') {
        if (info.band !== 'dab' || !features.tuner.initialScan || !['start', 'cancel'].includes(command.value) || (command.value === 'cancel') !== !!info.scanning) throw new Error('DAB scanning is unavailable.');
        route = command.value === 'start' ? 'tuner/startDabInitialScan' : 'tuner/cancelDabInitialScan'; params = {};
      } else {
        const preset = features.tuner.presets;
        if (!preset || !Number.isInteger(command.value) || command.value < 1 || command.value > preset.num) throw new Error('This preset is unavailable.');
        const band = preset.type === 'common' ? 'common' : info.band;
        const presets = parsePresets(await this.request('tuner/getPresetInfo', { band }), features.tuner);
        if (!presets.some(item => item.slot === command.value && (preset.type === 'common' || item.band === info.band))) throw new Error('This preset is empty or no longer available.');
        route = 'tuner/recallPreset'; params = { zone: 'main', band, num: String(command.value) };
      }
    }
    // Acknowledged tuning can continue asynchronously. Observe it without replaying the write.
    try {
      await write(route, params);
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt) await this.delay(200 * attempt);
        const next = await this.readSnapshot();
        if (next.status.power === 'on' && next.status.input === status.input && next.tuner && (command.type !== 'tunerBand' || next.tuner.band === command.value)) return next;
      }
    } catch { throw new Error('The radio command result is uncertain; refresh before trying again.'); }
    throw new Error('The radio did not report its state; refresh before trying again.');
  }

  private remember(page: BrowsePage): BrowsePage {
    this.page = { ...page, token: String(++this.revision) };
    return { ...this.page, items: this.page.items.map(item => ({ ...item })) };
  }

  private async browseReady(input: string) {
    const features = await this.capabilities();
    if (!features.sources.some(source => source.id === input && canBrowseSource(source))) throw new BrowseError('browseUnavailable');
    const status = parseStatus(await this.request('main/getStatus'));
    if (status.power !== 'on') throw new BrowseError('browseUnavailable');
  }

  private async list(input: string, index: number): Promise<BrowsePage> {
    // Yamaha can block all other commands while retrieving a menu for up to 30 seconds.
    return parseBrowsePage(await this.request('netusb/getListInfo', { input, list_id: 'main', index: String(index), size: '8', lang: 'en' }, { timeout: 35000 }), input, index);
  }

  browse(input: string, index = 0): Promise<BrowsePage> {
    return this.operation(async () => {
      this.page = undefined;
      try {
        if (!validBrowseIndex(index)) throw new BrowseError('browseReadError');
        await this.browseReady(input);
        return this.remember(await this.list(input, index));
      } catch (error) { throw error instanceof BrowseError ? error : new BrowseError('browseReadError'); }
    });
  }

  browseAction(action: BrowseAction): Promise<BrowseResult> {
    return this.operation(async () => {
      const expected = this.page;
      this.page = undefined;
      if (!validBrowseAction(action) || !expected || action.token !== expected.token) throw new BrowseError('browseChanged');
      // Other remotes share this menu. Re-read the same page before using an index.
      try {
        await this.browseReady(expected.input);
        if (!sameBrowsePage(expected, await this.list(expected.input, expected.index))) throw new BrowseError('browseChanged');
      } catch (error) { throw error instanceof BrowseError ? error : new BrowseError('browseReadError'); }
      const item = action.type === 'back' ? undefined : expected.items.find(item => item.index === action.index);
      if (action.type === 'back' ? expected.layer === 0 : !item || !(action.type === 'search' ? item.searchable : action.type === 'play' ? item.playable : item.selectable && !item.searchable)) throw new BrowseError('browseChanged');
      try {
        if (action.type === 'search') {
          await this.request('netusb/setSearchString', {}, { body: { list_id: 'main', index: action.index, string: action.text.trim() } });
        } else {
          await this.request('netusb/setListControl', { list_id: 'main', type: action.type === 'back' ? 'return' : action.type,
            ...(action.type !== 'back' ? { index: String(action.index) } : {}), ...(action.type === 'play' ? { zone: 'main' } : {}) });
        }
        const page = this.remember(await this.list(expected.input, action.type === 'play' ? expected.index : 0));
        return { page, ...(action.type === 'play' ? { snapshot: await this.readSnapshot() } : {}) };
      } catch { this.page = undefined; throw new BrowseError('uncertainError'); }
    });
  }
}
