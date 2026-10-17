import type { DeviceSession } from '@mosaicast/musiccast';

type Direction = 'up' | 'down';
export type VolumeOutput = {
  getVolume(): Promise<{ volume: number }>;
  setVolume(volume: number, options: { showUI: boolean }): Promise<void>;
  showNativeVolumeUI(options: { enabled: boolean }): Promise<void>;
  addVolumeListener(listener: (event: { volume: number }) => void): { remove(): void };
};

// Read the session at the press, rather than using a rendered snapshot. Never
// queue a press behind an uncertain write or invent a device's volume limits.
export function sendVolumeStep(session: Pick<DeviceSession, 'state' | 'execute'>, direction: Direction) {
  const state = session.state;
  const snapshot = state.snapshot;
  const range = snapshot?.features.volumeRange;
  const volume = snapshot?.status.volume;
  if (state.phase !== 'connected' || state.busy || state.needsRefresh || snapshot?.status.power !== 'on' ||
    !snapshot.features.controls.includes('volume') || !range || volume === undefined) return;
  const max = Math.min(range.max, snapshot.status.maxVolume ?? range.max);
  if (direction === 'up' ? volume >= max : volume <= range.min) return;
  void session.execute({ type: 'volume', value: direction });
}

// iOS exposes output-volume changes, not a public physical-button event. Keep
// the phone at a midpoint so both buttons work even at its original endpoints.
// Midpoint callbacks are our own changes and must never become Yamaha writes.
export function captureVolumeButtons(output: VolumeOutput, onStep: (direction: Direction) => void, onFailure: () => void) {
  const anchor = 0.5;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.005;
  let stopped = false;
  let armed = false;
  let changed = false;
  let original: number | undefined;
  let previous = anchor;
  let subscription: { remove(): void } | undefined;
  let pending = Promise.resolve();

  function fail() {
    if (!stopped) onFailure();
    stopped = true;
    subscription?.remove();
    void stop();
  }

  const ready = (async () => {
    const value = (await output.getVolume()).volume;
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Invalid volume');
    original = value;
    if (stopped) return;
    changed = true;
    await output.showNativeVolumeUI({ enabled: false });
    if (stopped) return;
    armed = near(value, anchor);
    subscription = output.addVolumeListener(({ volume }) => {
      if (stopped || !Number.isFinite(volume) || volume < 0 || volume > 1) return;
      if (near(volume, anchor)) { previous = anchor; armed = true; return; }
      if (!armed || near(volume, previous)) return;
      const direction = volume > previous ? 'up' : 'down';
      previous = volume;
      onStep(direction);
      pending = pending.then(() => stopped ? undefined : output.setVolume(anchor, { showUI: false })).catch(fail);
    });
    await output.setVolume(anchor, { showUI: false });
    if (!stopped) {
      if (!near((await output.getVolume()).volume, anchor)) throw new Error('Volume capture unavailable');
      armed = true;
    }
  })().catch(fail);

  let stopping: Promise<void> | undefined;
  function stop() {
    stopped = true;
    subscription?.remove();
    return stopping ??= (async () => {
      await ready;
      await pending;
      subscription?.remove();
      if (!changed) return;
      try {
        if (original !== undefined) await output.setVolume(original, { showUI: true });
      } catch { onFailure(); }
      try { await output.showNativeVolumeUI({ enabled: true }); }
      catch { onFailure(); }
    })();
  }
  return { ready, stop };
}
