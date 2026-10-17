import type { PeerRecord } from '@mosaicast/musiccast';
let pairing: PeerRecord | undefined;
export async function loadPairing() { return pairing; }
export async function savePairing(value: PeerRecord) { pairing = value; }
