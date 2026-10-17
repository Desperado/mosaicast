import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { DeviceSession } from '@mosaicast/musiccast';
import { captureVolumeButtons, sendVolumeStep } from './volume-buttons';

export function useHardwareVolume(enabled: boolean, session: DeviceSession) {
  const [unavailable, setUnavailable] = useState(false);
  // Effects can overlap during backgrounding or room changes. Finish restoring
  // the previous phone volume before a new capture reads its original value.
  const transition = useRef(Promise.resolve());
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let desired = enabled && AppState.currentState === 'active';
    let capture: ReturnType<typeof captureVolumeButtons> | undefined;
    function update() {
      transition.current = transition.current.then(async () => {
        if (capture && !desired) { await capture.stop(); capture = undefined; }
        if (!desired || capture) return;
        const { VolumeManager } = await import('react-native-volume-manager');
        if (!desired) return;
        setUnavailable(false);
        capture = captureVolumeButtons(VolumeManager, direction => {
          if (desired) sendVolumeStep(session, direction);
        }, () => setUnavailable(true));
        await capture.ready;
        if (!desired) { await capture.stop(); capture = undefined; }
      }).catch(() => setUnavailable(true));
    }
    update();
    const subscription = AppState.addEventListener('change', state => {
      desired = enabled && state === 'active';
      update();
    });
    return () => { desired = false; subscription.remove(); update(); };
  }, [enabled, session]);
  return unavailable;
}
