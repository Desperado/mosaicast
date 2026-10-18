import * as Network from 'expo-network';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { privateIPv4 } from '@mosaicast/musiccast';

const addressCodes = ['WIFI_UNAVAILABLE', 'WIFI_NO_IPV4', 'WIFI_NONPRIVATE_IPV4', 'INTERFACE_READ_FAILED', 'NATIVE_MODULE_MISSING', 'NATIVE_READ_FAILED', 'INVALID_ADDRESS'] as const;
export type AddressCode = typeof addressCodes[number];
export class LocalAddressError extends Error {
  readonly code: AddressCode;
  constructor(code: AddressCode) { super(code); this.code = code; }
}

export async function localSearchAddress(): Promise<string> {
  let address: string;
  if (Platform.OS === 'ios') {
    const native = requireOptionalNativeModule<{ localAddress?(): { address?: string; code?: string } }>('MosaicastPeer');
    if (!native?.localAddress) throw new LocalAddressError('NATIVE_MODULE_MISSING');
    let result;
    try { result = native.localAddress(); }
    catch { throw new LocalAddressError('NATIVE_READ_FAILED'); }
    if (!result?.address) throw new LocalAddressError(addressCodes.find(code => code === result?.code) ?? 'NATIVE_READ_FAILED');
    address = result.address;
  } else {
    // Android Expo Network reads WifiManager directly; browsers use .web.ts.
    address = await Network.getIpAddressAsync();
  }
  if (!privateIPv4(address)) throw new LocalAddressError('INVALID_ADDRESS');
  return address;
}
