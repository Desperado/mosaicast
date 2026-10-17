import { readPeerInvitation } from '@mosaicast/musiccast';

// Pairing secrets stay in memory, never in route params, history or error screens.
let pending: string | undefined;
let openedForPairing = false;
const listeners = new Set<() => void>();

export function redirectPairingLink(path: string): string {
  if (!/^mosaicast(?:-dev)?:\/\/pair(?:[\/?#]|$)/i.test(path)) return path;
  openedForPairing = true;
  try {
    const normalized = path.replace(/^mosaicast-dev:/i, 'mosaicast:');
    readPeerInvitation(normalized);
    pending = normalized;
  } catch { pending = ''; }
  for (const listener of listeners) listener();
  return '/companion';
}

export function takePairingLink(): string | undefined {
  const value = pending;
  pending = undefined;
  return value;
}

export function launchedForPairing(): boolean { return openedForPairing; }

export function subscribePairingLink(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
