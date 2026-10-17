import { BrowseError, privateIPv4, type BrowseErrorCode, type Controller } from '@mosaicast/musiccast';

// Yamaha does not advertise browser CORS. Only the laptop preview uses this loopback bridge.
export function deviceController(host: string): Controller {
  if (!privateIPv4(host)) throw new Error('Invalid address');
  async function request<T>(action: 'read' | 'command' | 'browse' | 'browse-action', data: Record<string, unknown> = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), action.startsWith('browse') ? 120000 : 30000);
    try {
      const response = await fetch(`http://127.0.0.1:8092/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host, ...data }),
        signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store',
      }).catch(() => {
        const error = new Error('Local bridge unavailable');
        error.name = 'BridgeUnavailableError';
        throw error;
      });
      const result = await response.json();
      if (!response.ok) {
        if (['browseChanged', 'browseUnavailable', 'browseReadError', 'uncertainError'].includes(result?.code)) throw new BrowseError(result.code as BrowseErrorCode);
        throw new Error('Local bridge request failed');
      }
      return result as T;
    } finally { clearTimeout(timer); }
  }
  return { mode: 'device', host, read: () => request('read'), execute: command => request('command', { command }),
    browse: (input, index = 0) => request('browse', { input, index }), browseAction: action => request('browse-action', { action }) };
}
