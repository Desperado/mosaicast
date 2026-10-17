import { redirectPairingLink } from '../state/pairing-link';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return redirectPairingLink(path);
}
