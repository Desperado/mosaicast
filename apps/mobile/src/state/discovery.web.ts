// Browsers cannot read the LAN address. Never call expo-network's public-IP service.
export async function localSearchAddress(): Promise<string> {
  throw new Error('Local discovery is available in the native app.');
}
