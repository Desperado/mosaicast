import type { Controller } from '@mosaicast/musiccast';
import type { AddressCode } from './discovery';
export type PeerStatus = { url?: string; comparison?: string; qr?: boolean; expires?: number; connected?: boolean; approved?: boolean; paired?: boolean; waiting?: boolean; unavailable?: boolean; startFailed?: boolean; failure?: 'address' | 'storage' | 'listener' | 'receiver'; saveFailed?: boolean; addressCode?: AddressCode };
export class PhoneCompanion implements Controller {
  readonly mode = 'device' as const;
  constructor(readonly host: string, notify: (status: PeerStatus) => void) { notify({ unavailable: true }); }
  private unavailable(): never { throw new Error('An iPhone development build is required'); }
  async read(): ReturnType<Controller['read']> { return this.unavailable(); }
  async execute(): ReturnType<Controller['execute']> { return this.unavailable(); }
  async browse(): ReturnType<Controller['browse']> { return this.unavailable(); }
  async browseAction(): ReturnType<Controller['browseAction']> { return this.unavailable(); }
  async acceptInvitation(_text: string) { this.unavailable(); }
  approve() {} cancelPairing() {} takeControl() {} close() {}
}
