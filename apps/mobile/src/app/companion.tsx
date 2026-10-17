import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import { radius } from '@mosaicast/design';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { privateIPv4, readPeerInvitation } from '@mosaicast/musiccast';
import { useApp } from '../state/app';
import { IPAddressInput } from '../components/ip-address-input';
import { BackHeader, Button, Copy, Screen, ScrollArea, styles } from '../components/ui';

export default function Companion() {
  const { t, preferences, connectCompanion, peerStatus, approvePeer, cancelPeer, takePeerControl } = useApp();
  const [host, setHost] = useState(preferences.address ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [qrError, setQRError] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);
  const [pendingInvitation, setPendingInvitation] = useState<string | undefined>(undefined);
  useFocusEffect(useCallback(() => () => setScanning(false), []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => { if (value === 'background') setScanning(false); });
    return () => subscription.remove();
  }, []);
  async function scan(data: string) {
    if (scanLock.current) return;
    scanLock.current = true; setScanning(false); setQRError(false);
    let invitation;
    try { invitation = readPeerInvitation(data); }
    catch { setQRError(true); return; }
    setPendingInvitation(data);
    const address = invitation.receiver ?? host;
    if (!privateIPv4(address)) { setManual(true); return; }
    setHost(address); setBusy(true); setFailed(false);
    try {
      if (await connectCompanion(address, data)) { setScanned(true); setPendingInvitation(undefined); }
      else setFailed(true);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }
  async function start() {
    if (busy || !privateIPv4(host)) return;
    setBusy(true); setFailed(false);
    try {
      if (pendingInvitation) readPeerInvitation(pendingInvitation);
      if (!await connectCompanion(host, pendingInvitation)) setFailed(true);
      else if (pendingInvitation) { setScanned(true); setPendingInvitation(undefined); }
    }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <Screen><BackHeader title={t('companion')}/><ScrollArea><View style={styles.stack}>
    <Copy>{t('qrBody')}</Copy>
    <Button label={t('scanTVQR')} primary disabled={busy} onPress={() => { scanLock.current = false; setPendingInvitation(undefined); setQRError(false); setCameraError(false); setScanning(true); }}/>
    {scanning && (Platform.OS !== 'ios' ? <Copy accessibilityRole="alert">{t('qrNativeRequired')}</Copy> : permission?.granted ? <>
      <View style={{ height: 280, overflow: 'hidden', borderRadius: radius.control }}><CameraView style={{ flex: 1 }} facing="back" autofocus="on" onMountError={() => { setCameraError(true); setScanning(false); }} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => { void scan(data); }}/></View>
      <Button label={t('close')} onPress={() => setScanning(false)}/>
    </> : <>
      <Copy>{t('cameraPermission')}</Copy>
      <Button label={t(permission?.canAskAgain === false ? 'cameraSettings' : 'allowCamera')} onPress={() => { void (permission?.canAskAgain === false ? Linking.openSettings() : requestPermission()).catch(() => setCameraError(true)); }}/>
    </>)}
    {cameraError && <Copy accessibilityRole="alert">{t('cameraUnavailable')}</Copy>}
    {qrError && <Copy accessibilityRole="alert">{t('qrInvalid')}</Copy>}
    {(peerStatus.qr || (scanned && !peerStatus.paired)) && <View accessibilityLiveRegion="polite"><Copy>{t('qrWaiting')}</Copy></View>}
    {peerStatus.saveFailed && <Copy accessibilityRole="alert">{t('phoneSaveFailed')}</Copy>}
    <Button label={t('manualPairing')} disabled={busy} onPress={() => { setPendingInvitation(undefined); cancelPeer(); setScanned(false); setScanning(false); setManual(value => !value); }}/>
    {manual && <Copy>{t('companionBody')}</Copy>}
    {manual && (!peerStatus.url || pendingInvitation) && <>
      {pendingInvitation && <Copy>{t('qrReceiver')}</Copy>}
      <Copy>{t('ipAddress')}</Copy>
      <IPAddressInput value={host} onChange={setHost} onSubmit={start} busy={busy} invalid={failed}/>
      <Button label={t(busy ? 'connecting' : 'hostPhone')} primary disabled={busy || !privateIPv4(host)} onPress={start}/>
    </>}
    {peerStatus.url && <>
      {manual && <><Copy>{t('phoneDiscoverable')}</Copy><Copy>{peerStatus.url}</Copy></>}
      {!peerStatus.qr && <Copy>{t(peerStatus.paired ? 'peerPaired' : 'peerWaiting')}</Copy>}
      {peerStatus.qr && <Button label={t('close')} onPress={() => { cancelPeer(); setScanned(false); }}/>}
      {peerStatus.comparison && <View accessibilityLiveRegion="polite" style={styles.stack}>
        <Copy>{t('compareScreens')}</Copy><Copy>{peerStatus.comparison}</Copy>
        <Button label={t(peerStatus.approved ? 'waitingTVConfirm' : 'codesMatch')} primary disabled={peerStatus.approved} onPress={approvePeer}/>
        <Button label={t('close')} onPress={cancelPeer}/>
      </View>}
      {peerStatus.waiting && <>
        <Copy>{t('peerWaitingAuthority')}</Copy>
        <Button label={t('tvClosedTakeControl')} onPress={takePeerControl}/>
      </>}
      <Button label={t('listen')} primary onPress={() => router.replace('/(tabs)/listen')}/>
    </>}
    {(failed || peerStatus.unavailable) && <Copy accessibilityRole="alert">{t(peerStatus.unavailable ? 'peerNativeRequired' : 'pairingFailed')}</Copy>}
  </View></ScrollArea></Screen>;
}
