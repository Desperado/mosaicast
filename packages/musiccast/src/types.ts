export type Power = 'on' | 'standby';
export type Playback = 'play' | 'pause' | 'stop';

export interface Source {
  id: string;
  name: string;
  networkPlayer: boolean;
  tuner?: boolean;
}

export interface Features {
  controls: string[];
  sources: Source[];
  connectivity: string[];
  bluetoothOutput?: boolean;
  tuner?: TunerFeatures;
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
  tuner?: TunerState;
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
  | { type: 'tunerBand'; value: TunerBand }
  | { type: 'tunerTune'; value: 'up' | 'down' | 'auto_up' | 'auto_down' }
  | { type: 'tunerService'; value: 'previous' | 'next' }
  | { type: 'tunerPreset'; value: number }
  | { type: 'tunerScan'; value: 'start' | 'cancel' }
  | { type: 'playback'; value: 'play' | 'pause' | 'previous' | 'next' };

export interface Controller {
  readonly mode: 'demo' | 'device';
  readonly host?: string;
  read(): Promise<Snapshot>;
  setActive?(active: boolean): void;
  close?(): void;
  reconcile?(): Promise<Snapshot>;
  watch?(listener: (state: { snapshot?: Snapshot; stale: boolean; needsRefresh: boolean; browse?: BrowsePage }) => void): () => void;
  execute(command: Command): Promise<Snapshot>;
  browse(input: string, index?: number, takeover?: boolean): Promise<BrowsePage>;
  browseAction(action: BrowseAction): Promise<BrowseResult>;
}

export interface BrowseItem {
  index: number;
  text: string;
  selectable: boolean;
  playable: boolean;
  searchable: boolean;
}

export interface BrowsePage {
  input: string;
  token: string;
  layer: number;
  title: string;
  index: number;
  total: number;
  items: BrowseItem[];
}

export type BrowseAction =
  | { type: 'back'; token: string }
  | { type: 'select' | 'play'; token: string; index: number }
  | { type: 'search'; token: string; index: number; text: string };

export interface BrowseResult {
  page: BrowsePage;
  snapshot?: Snapshot;
}

export type TunerBand = 'fm' | 'dab';
export interface TunerFeatures {
  bands: TunerBand[];
  initialScan?: boolean;
  fmRange?: { min: number; max: number; step: number };
  presets?: { type: 'common' | 'separate'; num: number };
}
export interface TunerPreset { slot: number; band: TunerBand; number: number }
export interface TunerState {
  band: TunerBand;
  preset?: number;
  frequency?: number;
  station: string;
  text: string;
  ready: boolean;
  scanning?: boolean;
  presets?: TunerPreset[];
}
