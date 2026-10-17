import { requireOptionalNativeModule } from 'expo';
import { CompanionController, CompanionCoordinator, MusicCastClient, PhonePeerService, peerDeviceFetch, type Controller, type PeerRandom } from '@mosaicast/musiccast';
import { localSearchAddress } from './discovery';
import { loadPairing, savePairing } from './pairing-store';

export type PeerStatus = { url?: string; comparison?: string; approved?: boolean; paired?: boolean; waiting?: boolean; unavailable?: boolean };
type PeerRequest = { id: string; method: string; path: string; body: string };
type PeerNative = {
  addListener(event: 'request', listener: (event: PeerRequest) => void): { remove(): void };
  start(host: string): Promise<void>; stop(): void; respond(id: string, status: number, body: string): void; randomHex(length: number): string;
};
const native = requireOptionalNativeModule<PeerNative>('MosaicastPeer');

export class PhoneCompanion implements Controller {
  readonly mode = 'device' as const;
  private ready?: Promise<CompanionController>;
  private service?: PhonePeerService;
  private controller?: CompanionController;
  private coordinator?: CompanionCoordinator;
  private draining = Promise.resolve();
  private subscription?: { remove(): void };
  private timer?: ReturnType<typeof setInterval>;
  private active = true;
  private closed = false;
  private generation = 0;
  constructor(readonly host: string, private readonly notify: (status: PeerStatus) => void) {}
  private status() {
    const service = this.service;
    this.notify(service ? { url: service.url, ...service.pairing, paired: service.paired, waiting: service.waitingForTV } : {});
  }
  private ensure() {
    if (!this.active || this.closed) return Promise.reject(new Error('Inactive'));
    if (this.ready) return this.ready;
    const generation = this.generation;
    this.ready = (async () => {
      if (!native) { this.notify({ unavailable: true }); throw new Error('An iPhone development build is required'); }
      await this.draining;
      const address = await localSearchAddress(), record = await loadPairing();
      if (generation !== this.generation) throw new Error('Inactive');
      const random: PeerRandom = length => Uint8Array.from(native.randomHex(length).match(/../g)!, byte => parseInt(byte, 16));
      const coordinator = new CompanionCoordinator(new MusicCastClient(this.host, peerDeviceFetch(() => !!this.service?.canControl && generation === this.generation)), native.randomHex(16));
      const service = new PhonePeerService(this.host, `http://${address}:8095`, coordinator, random, record, async value => { await savePairing(value); this.status(); });
      this.service = service; this.coordinator = coordinator;
      this.subscription = native.addListener('request', event => {
        if (generation !== this.generation) return;
        void Promise.resolve().then(() => service.handle(event.method, event.path, event.body ? JSON.parse(event.body) : undefined))
          .then(value => native.respond(event.id, 200, JSON.stringify(value)), () => native.respond(event.id, 400, '{}')).finally(() => this.status());
      });
      await native.start(address);
      if (generation !== this.generation) throw new Error('Inactive');
      await coordinator.poll();
      this.controller = new CompanionController(this.host, service.localExchange);
      this.timer = setInterval(() => { if (this.active) { void coordinator.poll(); this.status(); } }, 2000);
      this.status(); return this.controller;
    })().catch(error => { if (generation === this.generation) { this.stop(); this.notify({ unavailable: true }); } throw error; });
    return this.ready;
  }
  private stop() {
    ++this.generation;
    this.service?.close(); this.service = undefined;
    this.controller?.setActive(false);
    const coordinator = this.coordinator;
    if (coordinator?.state.activity) this.draining = new Promise<void>(resolve => {
      const stop = coordinator.subscribe(state => { if (!state.activity) { stop(); resolve(); } });
    });
    this.subscription?.remove(); this.subscription = undefined;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined; this.ready = undefined;
    native?.stop();
  }
  approve() { this.service?.approve(); this.status(); }
  cancelPairing() { this.service?.cancelPairing(); this.status(); }
  takeControl() { this.service?.takeControl(); this.status(); }
  close() { this.closed = true; this.stop(); this.notify({}); }
  setActive(active: boolean) { this.active = active; if (!active) this.stop(); }
  async read() { return (await this.ensure()).read(); }
  async reconcile() { return (await this.ensure()).reconcile(); }
  async execute(command: Parameters<Controller['execute']>[0]) { return (await this.ensure()).execute(command); }
  async browse(input: string, index = 0, takeover = false) { return (await this.ensure()).browse(input, index, takeover); }
  async browseAction(action: Parameters<Controller['browseAction']>[0]) { return (await this.ensure()).browseAction(action); }
  watch(listener: Parameters<NonNullable<Controller['watch']>>[0]) {
    let watching: CompanionController | undefined, stop: (() => void) | undefined;
    const tick = () => {
      if (this.controller && watching !== this.controller) { stop?.(); watching = this.controller; stop = watching.watch(listener); }
    };
    tick(); const timer = setInterval(tick, 500);
    return () => { clearInterval(timer); stop?.(); };
  }
}
