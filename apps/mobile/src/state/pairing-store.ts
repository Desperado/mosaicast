import * as SecureStore from 'expo-secure-store';
import { validPeer, type PeerRecord } from '@mosaicast/musiccast';
const key = 'mosaicast.peer.v1';
let writing: Promise<void> = Promise.resolve();
export async function loadPairing(): Promise<PeerRecord | undefined> {
  await writing.catch(() => {});
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return;
  const value: unknown = JSON.parse(raw);
  if (!validPeer(value)) throw new Error('Pair again');
  return value;
}
export function savePairing(value: PeerRecord) {
  const raw = JSON.stringify(value);
  writing = writing.catch(() => {}).then(async () => {
    await SecureStore.setItemAsync(key, raw, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    if (await SecureStore.getItemAsync(key) !== raw) throw new Error('Phone pairing storage unavailable');
  });
  return writing;
}
