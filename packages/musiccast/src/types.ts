export type Power = 'on' | 'standby';
export type Playback = 'play' | 'pause' | 'stop';

export interface Source {
  id: string;
  name: string;
  networkPlayer: boolean;
}

export interface Features {
  controls: string[];
  sources: Source[];
  connectivity: string[];
  bluetoothOutput?: boolean;
  volumeRange?: { min: number; max: number; step: number };
}

export interface Status {
  power: Power;
  input: string;
  volume?: number;
  maxVolume?: number;
  mute?: boolean;
}

export interface Track {
  title: string;
  artist: string;
  album: string;
  playback: Playback;
  elapsed?: number;
  duration?: number;
  artwork?: string;
}

export interface Snapshot {
  model: string;
  features: Features;
  status: Status;
  track?: Track;
  trackUnavailable: boolean;
  bluetooth?: BluetoothState;
}

export interface BluetoothDevice {
  name: string;
  address: string;
  type: 'loudspeaker' | 'headphone' | 'handsfree_device' | 'unknown';
}

export interface BluetoothState {
  enabled: boolean;
  connected?: BluetoothDevice;
  updating: boolean;
  devices: BluetoothDevice[];
}

export type BluetoothCommand =
  | { type: 'bluetoothOutput'; value: boolean }
  | { type: 'bluetoothScan'; value: 'start' }
  | { type: 'bluetoothConnect'; value: string }
  | { type: 'bluetoothDisconnect'; value: 'disconnect' };

export type Command =
  | BluetoothCommand
  | { type: 'power'; value: Power }
  | { type: 'input'; value: string }
  | { type: 'volume'; value: 'up' | 'down' }
  | { type: 'mute'; value: boolean }
  | { type: 'playback'; value: 'play' | 'pause' | 'previous' | 'next' };

export interface Controller {
  readonly mode: 'demo' | 'device';
  readonly host?: string;
  read(): Promise<Snapshot>;
  execute(command: Command): Promise<Snapshot>;
}
