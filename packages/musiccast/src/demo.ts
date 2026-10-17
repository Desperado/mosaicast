import type { Command, Controller, Snapshot, TunerState } from './types';
import { demoBrowsing } from './demo-browsing';

export function demoController(): Controller {
  const tracks = [
    { title: 'A slower kind of Sunday', artist: 'The Quiet Hours', album: 'Low tide hours', duration: 218 },
    { title: 'Light through the window', artist: 'Marrow Coast', album: 'Low tide hours', duration: 246 },
    { title: 'The blue hour', artist: 'The Quiet Hours', album: 'Evening shapes', duration: 193 },
  ];
  let trackIndex = 0;
  let radio: TunerState = { band: 'fm', frequency: 94500, station: 'Example FM', text: 'Fictional radio station', ready: true, presets: [{ slot: 1, band: 'fm', number: 94500 }, { slot: 2, band: 'fm', number: 101200 }] };
  let state: Snapshot = {
    model: 'Example listening room', trackUnavailable: false,
    features: {
      controls: ['power', 'volume', 'mute'], connectivity: ['Ethernet', 'Wi-Fi', 'AirPlay', 'Network standby'],
      tuner: { bands: ['fm', 'dab'], initialScan: true, fmRange: { min: 87500, max: 108000, step: 50 }, presets: { type: 'separate', num: 40 } },
      volumeRange: { min: 0, max: 63, step: 1 },
      sources: [
        { id: 'deezer', name: 'Deezer', networkPlayer: true }, { id: 'server', name: 'PC / NAS', networkPlayer: true },
        { id: 'usb', name: 'USB', networkPlayer: true }, { id: 'airplay', name: 'AirPlay', networkPlayer: true },
        { id: 'net_radio', name: 'Internet radio', networkPlayer: true },
        { id: 'cd', name: 'CD', networkPlayer: false }, { id: 'tuner', name: 'FM / DAB', networkPlayer: false, tuner: true },
      ],
    },
    status: { power: 'on', input: 'deezer', volume: 12, maxVolume: 63, mute: false },
    track: { ...tracks[trackIndex], playback: 'pause', elapsed: 42 },
  };
  const copy = () => JSON.parse(JSON.stringify(state)) as Snapshot;
  return {
    mode: 'demo',
    ...demoBrowsing(copy, (input, title) => {
      state = { ...state, status: { ...state.status, input }, track: { title, artist: 'The Quiet Hours', album: 'Low tide hours', playback: 'play', elapsed: 0 } };
      return copy();
    }),
    async read() { return copy(); },
    async execute(command: Command) {
      if (command.type === 'bluetoothOutput' || command.type === 'bluetoothScan' || command.type === 'bluetoothConnect' || command.type === 'bluetoothDisconnect') throw new Error('Bluetooth output is not simulated in demo mode.');
      const status = { ...state.status };
      switch (command.type) {
        case 'power': status.power = command.value; break;
        case 'input':
          if (!state.features.sources.some(source => source.id === command.value)) throw new Error('Unknown example source.');
          status.input = command.value; break;
        case 'volume': status.volume = Math.max(0, Math.min(63, status.volume! + (command.value === 'up' ? 1 : -1))); break;
        case 'mute': status.mute = command.value; break;
        case 'tunerBand':
          radio = { band: command.value, frequency: command.value === 'fm' ? 94500 : undefined, station: command.value === 'fm' ? 'Example FM' : 'Example DAB', text: 'Fictional radio station', ready: true,
            presets: command.value === 'fm' ? [{ slot: 1, band: 'fm', number: 94500 }, { slot: 2, band: 'fm', number: 101200 }] : [{ slot: 1, band: 'dab', number: 100 }] };
          break;
        case 'tunerTune':
          radio = { ...radio, frequency: Math.max(87500, Math.min(108000, (radio.frequency ?? 94500) + (command.value.includes('up') ? 1 : -1) * (command.value.startsWith('auto') ? 500 : 50))), station: 'Example FM', preset: undefined };
          break;
        case 'tunerScan': radio = { ...radio, scanning: command.value === 'start', ready: command.value === 'cancel' }; break;
        case 'tunerService': radio = { ...radio, station: radio.station === 'Example DAB' ? 'Another example DAB' : 'Example DAB', preset: undefined }; break;
        case 'tunerPreset': {
          const preset = radio.presets?.find(item => item.slot === command.value);
          if (preset) radio = { ...radio, preset: preset.slot, frequency: preset.band === 'fm' ? preset.number : undefined };
          break;
        }
        case 'playback':
          if (command.value === 'previous' || command.value === 'next') {
            trackIndex = (trackIndex + (command.value === 'next' ? 1 : tracks.length - 1)) % tracks.length;
            if (state.track) state.track = { ...tracks[trackIndex], playback: state.track.playback, elapsed: 0 };
          }
          if (state.track) state.track = { ...state.track, playback: command.value === 'pause' ? 'pause' : 'play' };
          break;
      }
      const supported = status.power === 'on' && state.features.sources.some(source => source.id === status.input && source.networkPlayer);
      state = { ...state, status, tuner: status.power === 'on' && status.input === 'tuner' ? { ...radio } : undefined, track: supported ? state.track || { ...tracks[trackIndex], playback: 'stop', elapsed: 0 } : undefined };
      return copy();
    },
  };
}
