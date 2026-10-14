import type { Command, Controller, Snapshot } from './types';

export function demoController(): Controller {
  let state: Snapshot = {
    model: 'Example listening room', trackUnavailable: false,
    features: {
      controls: ['power', 'volume', 'mute'], connectivity: ['Ethernet', 'Wi-Fi', 'AirPlay', 'Network standby'],
      volumeRange: { min: 0, max: 63, step: 1 },
      sources: [
        { id: 'deezer', name: 'Deezer', networkPlayer: true }, { id: 'server', name: 'PC / NAS', networkPlayer: true },
        { id: 'usb', name: 'USB', networkPlayer: true }, { id: 'airplay', name: 'AirPlay', networkPlayer: true },
        { id: 'cd', name: 'CD', networkPlayer: false }, { id: 'tuner', name: 'FM / DAB', networkPlayer: false },
      ],
    },
    status: { power: 'on', input: 'deezer', volume: 12, maxVolume: 63, mute: false },
    track: { title: 'A slower kind of Sunday', artist: 'The Quiet Hours', album: 'Example music', playback: 'pause', elapsed: 42, duration: 218 },
  };
  const copy = () => JSON.parse(JSON.stringify(state)) as Snapshot;
  return {
    mode: 'demo',
    async read() { return copy(); },
    async execute(command: Command) {
      const status = { ...state.status };
      switch (command.type) {
        case 'power': status.power = command.value; break;
        case 'input':
          if (!state.features.sources.some(source => source.id === command.value)) throw new Error('Unknown example source.');
          status.input = command.value; break;
        case 'volume': status.volume = Math.max(0, Math.min(63, status.volume! + (command.value === 'up' ? 1 : -1))); break;
        case 'mute': status.mute = command.value; break;
        case 'playback':
          if (state.track) state.track = { ...state.track, playback: command.value === 'pause' ? 'pause' : 'play' };
          break;
      }
      const supported = status.power === 'on' && state.features.sources.some(source => source.id === status.input && source.networkPlayer);
      state = { ...state, status, track: supported ? state.track || { title: 'Light through the window', artist: 'The Quiet Hours', album: 'Example music', playback: 'stop', elapsed: 0, duration: 218 } : undefined };
      return copy();
    },
  };
}
