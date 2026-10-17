import { privateIPv4, record } from './parsers';

export type DiscoveredDevice = { host: string; model: string };

// shortcut: search the phone's /24 only. We do not know the network's netmask.
export function discoveryPrefix(localAddress: string): string {
  if (!privateIPv4(localAddress)) throw new Error('A private local IPv4 address is required.');
  return localAddress.slice(0, localAddress.lastIndexOf('.'));
}

async function discoverLocal<T>(localAddress: string, path: string, parse: (data: Record<string, unknown>, host: string) => T | undefined, options: {
  signal: AbortSignal;
  onDevice: (device: T) => void;
  fetcher?: typeof globalThis.fetch;
}): Promise<T[]> {
  const prefix = discoveryPrefix(localAddress);
  const { signal, onDevice, fetcher = (url, init) => globalThis.fetch(url, init) } = options;
  const devices: T[] = [];
  let next = 1;
  async function probe(host: string) {
    const request = new AbortController();
    const abort = () => request.abort();
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 1200);
    try {
      const response = await fetcher(`http://${host}${path}`, {
        method: 'GET', signal: request.signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
      });
      if (!response.ok || response.redirected || Number(response.headers.get('content-length')) > 16384) return;
      const text = await response.text();
      if (text.length > 16384) return;
      const data = record(JSON.parse(text));
      const device = parse(data, host);
      if (!device || signal.aborted || request.signal.aborted) return;
      devices.push(device);
      onDevice(device);
    } catch {
      // Most addresses offer no matching service. No retry and no device writes.
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

export function discoverMusicCast(localAddress: string, options: {
  signal: AbortSignal;
  onDevice: (device: DiscoveredDevice) => void;
  fetcher?: typeof globalThis.fetch;
}): Promise<DiscoveredDevice[]> {
  return discoverLocal(localAddress, '/YamahaExtendedControl/v1/system/getDeviceInfo', (data, host) => {
    if (data.response_code !== 0 || typeof data.model_name !== 'string' || !data.model_name.trim()) return;
    return { host, model: data.model_name.trim().slice(0, 80) };
  }, options);
}

export type DiscoveredCompanion = { url: string };

export function discoverPeers(localAddress: string, options: {
  signal: AbortSignal; onDevice: (device: DiscoveredCompanion) => void; fetcher?: typeof globalThis.fetch;
}): Promise<DiscoveredCompanion[]> {
  return discoverLocal(localAddress, ':8095/.well-known/mosaicast-peer', (data, host) => {
    if (data.service === 'mosaicast-peer' && data.version === 1 && data.url === `http://${host}:8095` && typeof data.epoch === 'string' && /^[a-f0-9]{32}$/.test(data.epoch)) return { url: data.url as string };
  }, options);
}
