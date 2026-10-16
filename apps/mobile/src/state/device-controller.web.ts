import { privateIPv4, type Command, type Controller, type Snapshot } from '@mosaicast/musiccast';

// Yamaha does not advertise browser CORS. Only the laptop preview uses this loopback bridge.
export function deviceController(host: string): Controller {
  if (!privateIPv4(host)) throw new Error('Invalid address');
  async function request(action: 'read' | 'command', command?: Command): Promise<Snapshot> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`http://127.0.0.1:8092/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host, command }),
        signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store',
      }).catch(() => {
        const error = new Error('Local bridge unavailable');
        error.name = 'BridgeUnavailableError';
        throw error;
      });
      if (!response.ok) throw new Error('Local bridge request failed');
      return await response.json() as Snapshot;
    } finally { clearTimeout(timer); }
  }
  return { mode: 'device', host, read: () => request('read'), execute: command => request('command', command) };
}
