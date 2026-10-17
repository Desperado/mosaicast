export { MusicCastClient } from './client';
export { CommandRejectedError } from './command-error';
export { demoController } from './demo';
export { privateIPv4 } from './parsers';
export { discoverMusicCast, discoveryPrefix, type DiscoveredDevice, type DiscoveredCompanion } from './discovery';
export type { BluetoothCommand, BluetoothDevice, BluetoothState, Command, Controller, Features, Power, Playback, Snapshot, Source, Status, Track } from './types';

export { DeviceSession, type DeviceState } from './session';
export { BrowseError, canBrowseSource, validBrowseAction, validBrowseIndex, type BrowseErrorCode } from './browsing';
export type { BrowseAction, BrowseItem, BrowsePage, BrowseResult } from './types';
export type { TunerBand, TunerFeatures, TunerPreset, TunerState } from './types';
export { CompanionCoordinator, CompanionController, CompanionError, companionVersion, validCompanionRequest, validCommand } from './companion';
export type { CompanionState, CompanionRequest, CompanionReply, CompanionOperation, CompanionExchange, CompanionCode } from './companion';
export { PhonePeerService, beginPeerPairing, connectPeer, validPeer, peerURL } from './peer';
export { discoverPeers } from './discovery';
export type { PeerRecord, PeerRandom } from './peer-crypto';
export { createTVPeerController, peerDeviceFetch } from './peer-controller';
