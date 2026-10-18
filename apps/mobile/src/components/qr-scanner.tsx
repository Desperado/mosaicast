import { useRef, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import { CameraView } from 'expo-camera';
import { radius } from '@mosaicast/design';
import { useApp } from '../state/app';
import { Button, Copy, styles } from './ui';

export function QRScanner({ onScan, onError }: { onScan: (data: string) => void; onError: () => void }) {
  const { t } = useApp();
  const [zoom, setZoom] = useState(0);
  const pinch = useRef<{ distance: number; zoom: number } | undefined>(undefined);
  function move(event: GestureResponderEvent) {
    const [a, b] = event.nativeEvent.touches;
    if (!a || !b) { pinch.current = undefined; return; }
    const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
    const start = pinch.current;
    if (!start || start.distance === 0) { pinch.current = { distance, zoom }; return; }
    setZoom(Math.max(0, Math.min(0.5, start.zoom + Math.log2(distance / start.distance) * 0.15)));
  }
  return <View style={styles.smallStack}>
    <View style={{ height: 300, overflow: 'hidden', borderRadius: radius.control }}
      onStartShouldSetResponderCapture={event => event.nativeEvent.touches.length >= 2}
      onMoveShouldSetResponderCapture={event => event.nativeEvent.touches.length >= 2}
      onResponderGrant={move} onResponderMove={move}
      onResponderRelease={() => { pinch.current = undefined; }} onResponderTerminate={() => { pinch.current = undefined; }}>
      <CameraView style={{ flex: 1 }} facing="back" autofocus="on" zoom={zoom} onMountError={onError}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => onScan(data)}/>
    </View>
    <Copy kind="small">{t('qrZoomHint')}</Copy>
    <View style={styles.row}>
      <Button label={t('zoomOut')} disabled={zoom <= 0} onPress={() => setZoom(value => Math.max(0, value - 0.05))}/>
      <Button label={t('zoomIn')} disabled={zoom >= 0.5} onPress={() => setZoom(value => Math.min(0.5, value + 0.05))}/>
    </View>
  </View>;
}
