import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, View } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { privateIPv4, readPeerInvitation } from '@mosaicast/musiccast';
import { useApp } from '../state/app';
import { subscribePairingLink, takePairingLink } from '../state/pairing-link';
import { QRScanner } from '../components/qr-scanner';
import { IPAddressInput } from '../components/ip-address-input';
import { BackHeader, Button, Card, Copy, Screen, ScrollArea, styles } from '../components/ui';

export default function Companion() {
  const { t, colors, ready, deviceState, preferences, connectCompanion, peerStatus, approvePeer, cancelPeer, takePeerControl, refresh } = useApp();
  const [host, setHost] = useState(preferences.address ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [qrError, setQRError] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [expires, setExpires] = useState(0);
  const [started, setStarted] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);
  const [pendingInvitation, setPendingInvitation] = useState<string | undefined>(undefined);
  const connected = !busy && !peerStatus.qr && !pendingInvitation && !!peerStatus.connected;
  const deadline = peerStatus.expires ?? expires;
  const expired = (scanned || !!peerStatus.qr) && !connected && now >= deadline;
  const pairing = !failed && !expired && (busy || !!peerStatus.qr || (scanned && !connected));
  // A later TV disconnect must not revive the completed QR attempt.
  if (connected && scanned) { setScanned(false); setStarted(0); }
  useFocusEffect(useCallback(() => () => setScanning(false), []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => { if (value === 'background') setScanning(false); });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!pairing) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pairing]);
  const scan = useCallback(async (data: string) => {
    if (scanLock.current) return;
    scanLock.current = true; setScanning(false); setQRError(false); setFailed(false);
    let invitation;
    try { invitation = readPeerInvitation(data); }
    catch { setQRError(true); setScanned(false); setPendingInvitation(undefined); return; }
    setPendingInvitation(data); setScanned(true); setExpires(invitation.expires); setStarted(Date.now()); setNow(Date.now());
    const address = invitation.receiver ?? host;
    if (!privateIPv4(address)) { setManual(true); return; }
    setManual(false); setHost(address); setBusy(true);
    try {
      if (await connectCompanion(address, data)) setPendingInvitation(undefined);
      else setFailed(true);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }, [host, connectCompanion]);
  useFocusEffect(useCallback(() => {
    const receive = () => {
      if (!ready || deviceState.busy || busy) return;
      const data = takePairingLink();
      if (data !== undefined) { scanLock.current = false; void scan(data); }
    };
    const stop = subscribePairingLink(receive);
    receive();
    return stop;
  }, [ready, deviceState.busy, busy, scan]));
  async function start() {
    if (busy || !privateIPv4(host)) return;
    setBusy(true); setFailed(false);
    try {
      if (pendingInvitation) readPeerInvitation(pendingInvitation);
      if (!await connectCompanion(host, pendingInvitation)) setFailed(true);
      else if (pendingInvitation) setPendingInvitation(undefined);
    }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }
  function openScanner() {
    cancelPeer(); scanLock.current = false; setPendingInvitation(undefined); setScanned(false);
    setFailed(false); setQRError(false); setCameraError(false); setManual(false); setScanning(true);
  }
  function cancel() {
    cancelPeer(); setPendingInvitation(undefined); setScanned(false); setScanning(false);
  }
  return <Screen><BackHeader title={t('companion')}/><ScrollArea><View style={styles.stack}>
    {connected ? <Card>
      <Copy kind="heading">{t('phoneTVConnected')}</Copy>
      <Copy>{t('phoneTVConnectedBody')}</Copy>
      <Button label={t('listen')} primary disabled={deviceState.busy} onPress={async () => { await refresh(); router.replace('/(tabs)/listen'); }}/>
    </Card> : <>
      <Copy>{t('qrBody')}</Copy>
      {pairing && <Card><View accessibilityLiveRegion="polite" style={styles.smallStack}>
        <ActivityIndicator color={colors.accent}/>
        <Copy kind="heading">{t('phoneTVConnecting')}</Copy>
        <Copy>{t('qrWaiting')}</Copy>
        {now - (started || deadline - 300000) >= 30000 && <Copy>{t('qrSlow')}</Copy>}
      </View></Card>}
      {!pairing && !scanning && <Button label={t('scanTVQR')} primary disabled={busy || !ready || deviceState.busy} onPress={openScanner}/>}
    </>}
    {scanning && (Platform.OS !== 'ios' ? <Copy accessibilityRole="alert">{t('qrNativeRequired')}</Copy> : permission?.granted ? <>
      <QRScanner onScan={data => { void scan(data); }} onError={() => { setCameraError(true); setScanning(false); }}/>
      <Button label={t('close')} onPress={() => setScanning(false)}/>
    </> : <>
      <Copy>{t('cameraPermission')}</Copy>
      <Button label={t(permission?.canAskAgain === false ? 'cameraSettings' : 'allowCamera')} onPress={() => { void (permission?.canAskAgain === false ? Linking.openSettings() : requestPermission()).catch(() => setCameraError(true)); }}/>
      <Button label={t('close')} onPress={() => setScanning(false)}/>
    </>)}
    {cameraError && <Copy accessibilityRole="alert">{t('cameraUnavailable')}</Copy>}
    {(qrError || expired) && <Copy accessibilityRole="alert">{t('qrInvalid')}</Copy>}
    {peerStatus.saveFailed && <Copy accessibilityRole="alert">{t('phoneSaveFailed')}</Copy>}
    {pairing && <Button label={t('cancelPairing')} disabled={busy} onPress={cancel}/>}
    {!scanning && !busy && <Button label={t(manual ? 'close' : 'pairingHelp')} onPress={() => setManual(value => !value)}/>}
    {manual && <Card>
      <Copy>{t(pairing ? 'qrSlow' : 'companionBody')}</Copy>
      {(!pairing || pendingInvitation) && <>
        <Copy>{t('qrReceiver')}</Copy>
        <IPAddressInput value={host} onChange={setHost} onSubmit={start} busy={busy} invalid={failed}/>
        <Button label={t(busy ? 'connecting' : 'hostPhone')} disabled={busy || !privateIPv4(host)} onPress={start}/>
      </>}
      {peerStatus.url && <><Copy>{t('phoneDiscoverable')}</Copy><Copy>{peerStatus.url}</Copy></>}
      {!pairing && !connected && peerStatus.paired && <Copy>{t('peerPaired')}</Copy>}
      {!pairing && !connected && peerStatus.waiting && <>
        <Copy>{t('peerWaitingAuthority')}</Copy>
        <Button label={t('tvClosedTakeControl')} onPress={async () => { takePeerControl(); await refresh(); router.replace('/(tabs)/listen'); }}/>
      </>}
    </Card>}
    {peerStatus.comparison && !peerStatus.qr && <Card>
      <Copy>{t('compareScreens')}</Copy><Copy>{peerStatus.comparison}</Copy>
      <Button label={t(peerStatus.approved ? 'waitingTVConfirm' : 'codesMatch')} primary disabled={peerStatus.approved} onPress={approvePeer}/>
      <Button label={t('cancelPairing')} onPress={cancel}/>
    </Card>}
    {(failed || peerStatus.unavailable) && <Copy accessibilityRole="alert">{t(peerStatus.unavailable ? 'peerNativeRequired' : 'pairingFailed')}</Copy>}
  </View></ScrollArea></Screen>;
}
