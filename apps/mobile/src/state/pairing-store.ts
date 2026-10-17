import * as SecureStore from 'expo-secure-store';
import { validPeer, type PeerRecord } from '@mosaicast/musiccast';
const key = 'mosaicast.peer.v1';
export async function loadPairing(): Promise<PeerRecord | undefined> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return;
  const value: unknown = JSON.parse(raw);
  if (!validPeer(value)) throw new Error('Pair again');
  return value;
}
export function savePairing(value: PeerRecord) {
  return SecureStore.setItemAsync(key, JSON.stringify(value), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
