import * as Network from 'expo-network';
import { privateIPv4 } from '@mosaicast/musiccast';

export async function localSearchAddress(): Promise<string> {
  // Native Expo reads the LAN interface directly. Default-route state can be
  // unknown (for example with a VPN) even while this local address is usable.
  const address = await Network.getIpAddressAsync();
  if (!privateIPv4(address)) throw new Error('No private local IPv4 address is available.');
  return address;
}
