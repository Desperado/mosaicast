import { privateIPv4, record } from './parsers';

export type DiscoveredDevice = { host: string; model: string };

// shortcut: search the phone's /24 only. We do not know the network's netmask.
export function discoveryPrefix(localAddress: string): string {
  if (!privateIPv4(localAddress)) throw new Error('A private local IPv4 address is required.');
  return localAddress.slice(0, localAddress.lastIndexOf('.'));
}

export async function discoverMusicCast(localAddress: string, options: {
  signal: AbortSignal;
  onDevice: (device: DiscoveredDevice) => void;
  fetcher?: typeof globalThis.fetch;
}): Promise<DiscoveredDevice[]> {
  const prefix = discoveryPrefix(localAddress);
  const { signal, onDevice, fetcher = (url, init) => globalThis.fetch(url, init) } = options;
  const devices: DiscoveredDevice[] = [];
  let next = 1;
  async function probe(host: string) {
    const request = new AbortController();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 1200);
    try {
      const response = await fetcher(`http://${host}/YamahaExtendedControl/v1/system/getDeviceInfo`, {
        method: 'GET', signal: request.signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
      });
      if (!response.ok || response.redirected || Number(response.headers.get('content-length')) > 16384) return;
      const text = await response.text();
      if (text.length > 16384) return;
      const data = record(JSON.parse(text));
      if (data.response_code !== 0 || typeof data.model_name !== 'string' || !data.model_name.trim()) return;
      if (signal.aborted || request.signal.aborted) return;
      const device = { host, model: data.model_name.trim().slice(0, 80) };
      devices.push(device);
      onDevice(device);
    } catch {
      // Most addresses are not Yamaha devices. No retry and no device writes.
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }
  async function worker() {
    while (!signal.aborted && next <= 254) {
      const host = `${prefix}.${next++}`;
      if (host !== localAddress) await probe(host);
    }
  }
  // At most 12 read-only requests at once, normally under 30 seconds in total.
  await Promise.all(Array.from({ length: 12 }, worker));
  return devices;
}
