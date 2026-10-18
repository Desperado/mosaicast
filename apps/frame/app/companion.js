import companionAPI from '../../../packages/musiccast/dist/index.js';

const pairingKey = 'mosaicast-peer-v1';
let previewPairing;
function peerRandom(length) {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random generator unavailable.');
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}
export function savedCompanion() {
  const store = globalThis.tizen?.keymanager;
  if (!store) return globalThis.tizen ? undefined : previewPairing;
  try {
    const value = JSON.parse(store.getData({ name: pairingKey }));
    return companionAPI.validPeer(value) ? value : undefined;
  } catch { return; }
}
export async function pairFrame(url) {
  if (globalThis.tizen && !globalThis.tizen.keymanager) throw new Error('Secure storage unavailable. Check TV permissions.');
  const pending = await companionAPI.beginPeerPairing(url, peerRandom);
  return { comparison: pending.comparison, confirm: async () => {
    const value = await pending.confirm();
    const store = globalThis.tizen?.keymanager;
    if (store) {
      try { store.removeData({ name: pairingKey }); } catch (error) { if (error.name !== 'NotFoundError') throw new Error('Secure storage unavailable.'); }
      await new Promise((resolve, reject) => store.saveData(pairingKey, JSON.stringify(value), null, resolve, () => reject(new Error('Secure storage unavailable.'))));
    } else previewPairing = value;
    return value;
  } };
}
export function companionFeatures(snapshot) {
  const f = snapshot.features;
  return {
    system: { func_list: f.connectivity, input_list: f.sources.map(s => ({ id: s.id, play_info_type: s.networkPlayer ? 'netusb' : s.tuner ? 'tuner' : 'none' })) },
    zone: [{ id: 'main', func_list: f.controls.filter(c => c !== 'prepare_input_change'), input_list: f.sources.map(s => s.id), range_step: f.volumeRange ? [{ id: 'volume', ...f.volumeRange }] : [] }],
    tuner: { func_list: f.tuner?.bands || [] },
  };
}
export const companionStatus = snapshot => ({ ...snapshot.status, max_volume: snapshot.status.maxVolume });
export const companionInfo = snapshot => snapshot.track ? {
  input: snapshot.status.input, track: snapshot.track.title, artist: snapshot.track.artist, album: snapshot.track.album,
  playback: snapshot.track.playback, play_time: snapshot.track.elapsed, total_time: snapshot.track.duration, albumart_url: snapshot.track.artwork,
} : snapshot.trackUnavailable ? { error: 'Playback information unavailable' } : {};
export function companionMenu(page) {
  return { input: page.input, token: page.token, menu_layer: page.layer, menu_name: page.title, index: page.index, max_line: page.total,
    list_info: page.items.map(item => ({ text: item.text, attribute: (item.selectable ? 2 : 0) | (item.playable ? 4 : 0) | (item.searchable ? 8 : 0) })) };
}
export function companionMessage(error) {
  if (['owned', 'companionOwned'].includes(error.code)) return 'The other app owns this menu. Choose Take over menu to continue here.';
  if (['busy', 'companionBusy'].includes(error.code)) return 'Yamaha is busy with another operation. Wait, then try again.';
  if (error.code === 'browseChanged') return 'The shared menu changed. Refresh and choose your item again.';
  if (error.code === 'browseUnavailable') return 'This Yamaha does not offer this menu.';
  if (['uncertain', 'uncertainError', 'reconcile', 'generation'].includes(error.code)) return 'The last action needs checking. Choose Refresh before sending another command.';
  return 'Phone connection lost. Keep both apps on the same Wi-Fi. After a minute, choose Refresh to coordinate on this TV. An uncertain action is never replayed.';
}

// Semantic bridge for the existing TV presentation. No raw Yamaha requests leave this adapter.
export class FrameCompanion {
  constructor(pairing) {
    this.host = pairing.receiver;
    this.urls = [];
    this.controller = companionAPI.createTVPeerController(pairing, peerRandom, () => this.urls);
    this.active = true;
    this.searchTimer = setInterval(() => this.discover(), 30000);
    this.searchTimer?.unref?.();
    this.discover();
    this.companion = true;
    this.pending = 0;
  }
  async run(work) {
    if (this.pending) throw new Error('Yamaha is busy. Wait, then try again.');
    this.pending++;
    try { return await work(); } catch (error) { throw Object.assign(new Error(companionMessage(error)), { code: error.code }); }
    finally { this.pending--; }
  }
  async request(route, params = {}) {
    if (route === 'netusb/setPlayback') {
      const snapshot = this.controller.state?.snapshot;
      let value = params.playback;
      if (value === 'play_pause') value = snapshot?.track?.playback === 'play' ? 'pause' : 'play';
      if (!['play', 'pause', 'previous', 'next'].includes(value)) throw new Error('Use Pause for this receiver.');
      await this.command({ type: 'playback', value }); return {};
    }
    const snapshot = await this.run(() => this.controller.read());
    if (route === 'system/getDeviceInfo') return { model_name: snapshot.model };
    if (route === 'system/getFeatures') return companionFeatures(snapshot);
    if (route === 'main/getStatus') return companionStatus(snapshot);
    if (route === 'netusb/getPlayInfo') return companionInfo(snapshot);
    throw new Error('Unsupported companion operation.');
  }
  command(command) { return this.run(() => this.controller.execute(command)); }
  async sound(command) {
    const before = this.controller.state?.snapshot;
    if (command === 'mute' && typeof before?.status.mute !== 'boolean') throw new Error('Mute status unavailable. Refresh first.');
    return companionStatus(await this.command(command === 'mute' ? { type: 'mute', value: !before.status.mute } : { type: 'volume', value: command }));
  }
  async power(value) { return companionStatus(await this.command({ type: 'power', value })); }
  async selectInput(value) { return companionStatus(await this.command({ type: 'input', value })); }
  async list(index = 0, input = 'deezer', takeover = false) {
    try {
      this.page = await this.run(() => this.controller.browse(input, index, takeover));
      return companionMenu(this.page);
    } catch (error) { error.menuInput = input; throw error; }
  }
  async control(type, index) { return this.menuAction(type === 'return' ? { type: 'back' } : { type, index }); }
  async search(index, text) { return this.menuAction({ type: 'search', index, text }); }
  async menuAction(action) {
    if (!this.page) throw new Error('Refresh the shared menu first.');
    try {
      const result = await this.run(() => this.controller.browseAction({ ...action, token: this.page.token }));
      this.page = result.page;
      return companionMenu(this.page);
    } catch (error) { error.menuInput = this.page.input; throw error; }
  }
  async reconcile() { return this.run(() => this.controller.reconcile()); }
  watch(listener) { return this.controller.watch(listener); }
  discover() {
    if (!this.active || this.discoverySearch) return;
    const search = new AbortController(); this.discoverySearch = search;
    void findFrameCompanions(search.signal, device => {
      if (!search.signal.aborted && !this.urls.includes(device.url)) this.urls = [...this.urls.slice(-3), device.url];
    }).catch(() => {}).finally(() => { if (this.discoverySearch === search) this.discoverySearch = undefined; });
  }
  close() { this.active = false; this.discoverySearch?.abort(); clearInterval(this.searchTimer); this.controller.close(); }
  setActive(active) { this.active = active; this.controller.setActive(active); if (!active) this.discoverySearch?.abort(); else this.discover(); }
}

export function companionTuner(snapshot) {
  const features = snapshot?.features.tuner, tuner = snapshot?.tuner;
  if (snapshot?.status.power !== 'on' || !features || !tuner || !snapshot.features.sources.some(source => source.id === snapshot.status.input && source.tuner)) return;
  const controls = features.bands.map(band => ({ id: `band-${band}`, label: band.toUpperCase(), command: { type: 'tunerBand', value: band }, disabled: tuner.band === band }));
  if (tuner.band === 'fm' && features.fmRange && tuner.frequency >= features.fmRange.min && tuner.frequency <= features.fmRange.max) {
    for (const [value, label] of [['down', 'Tune −'], ['up', 'Tune +'], ['auto_down', 'Seek −'], ['auto_up', 'Seek +']]) controls.push({ id: value, label, command: { type: 'tunerTune', value } });
  }
  if (tuner.band === 'dab' && tuner.ready) {
    for (const value of ['previous', 'next']) controls.push({ id: `service-${value}`, label: `${value === 'next' ? 'Next' : 'Previous'} station`, command: { type: 'tunerService', value } });
  }
  if (tuner.band === 'dab' && features.initialScan) controls.push({ id: 'scan', label: tuner.scanning ? 'Cancel scan' : 'Scan DAB', command: { type: 'tunerScan', value: tuner.scanning ? 'cancel' : 'start' } });
  const presets = features.presets ? (tuner.presets || []).filter(preset => features.presets.type === 'common' || preset.band === tuner.band) : [];
  if (presets.length) {
    const index = presets.findIndex(preset => preset.slot === tuner.preset);
    for (const [direction, offset] of [['previous', -1], ['next', 1]]) {
      const preset = presets[index < 0 ? 0 : (index + offset + presets.length) % presets.length];
      controls.push({ id: `preset-${direction}`, label: `${direction === 'next' ? 'Next' : 'Previous'} preset (${preset.slot})`, command: { type: 'tunerPreset', value: preset.slot } });
    }
  }
  return { title: tuner.station || (tuner.band === 'fm' && Number.isFinite(tuner.frequency) ? `${tuner.frequency / 1000} MHz` : 'DAB radio'),
    description: [tuner.band.toUpperCase(), tuner.scanning ? 'Scanning…' : tuner.ready ? 'Tuned' : 'Waiting for signal', tuner.text].filter(Boolean).join(' · '), controls };
}

export async function findFrameCompanions(signal, onDevice) {
  const host = globalThis.webapis?.network?.getIp();
  if (!companionAPI.privateIPv4(host)) throw new Error('Local discovery unavailable. Enter the phone address.');
  return companionAPI.discoverPeers(host, { signal, onDevice });
}
