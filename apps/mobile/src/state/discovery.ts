import * as Network from 'expo-network';
import { privateIPv4 } from '@mosaicast/musiccast';

export async function localSearchAddress(): Promise<string> {
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected || (state.type !== Network.NetworkStateType.WIFI && state.type !== Network.NetworkStateType.ETHERNET)) {
    throw new Error('Connect to a local Wi-Fi network first.');
  }
  const address = await Network.getIpAddressAsync();
  if (!privateIPv4(address)) throw new Error('No private local IPv4 address is available.');
  return address;
}
