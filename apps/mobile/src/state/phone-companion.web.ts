import type { Controller } from '@mosaicast/musiccast';
export type PeerStatus = { url?: string; comparison?: string; approved?: boolean; paired?: boolean; waiting?: boolean; unavailable?: boolean };
export class PhoneCompanion implements Controller {
  readonly mode = 'device' as const;
  constructor(readonly host: string, notify: (status: PeerStatus) => void) { notify({ unavailable: true }); }
  private unavailable(): never { throw new Error('An iPhone development build is required'); }
  async read(): ReturnType<Controller['read']> { return this.unavailable(); }
  async execute(): ReturnType<Controller['execute']> { return this.unavailable(); }
  async browse(): ReturnType<Controller['browse']> { return this.unavailable(); }
  async browseAction(): ReturnType<Controller['browseAction']> { return this.unavailable(); }
  approve() {} cancelPairing() {} takeControl() {} close() {}
}
