import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { privateIPv4 } from '@mosaicast/musiccast';
import { useApp } from '../state/app';
import { IPAddressInput } from '../components/ip-address-input';
import { BackHeader, Button, Copy, Screen, ScrollArea, styles } from '../components/ui';

export default function Companion() {
  const { t, preferences, connectCompanion, peerStatus, approvePeer, cancelPeer, takePeerControl } = useApp();
  const [host, setHost] = useState(preferences.address ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function start() {
    if (busy || !privateIPv4(host)) return;
    setBusy(true); setFailed(false);
    try { if (!await connectCompanion(host)) setFailed(true); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <Screen><BackHeader title={t('companion')}/><ScrollArea><View style={styles.stack}>
    <Copy>{t('companionBody')}</Copy>
    {!peerStatus.url && <>
      <Copy>{t('ipAddress')}</Copy>
      <IPAddressInput value={host} onChange={setHost} onSubmit={start} busy={busy} invalid={failed}/>
      <Button label={t(busy ? 'connecting' : 'hostPhone')} primary disabled={busy || !privateIPv4(host)} onPress={start}/>
    </>}
    {peerStatus.url && <>
      <Copy>{t('phoneDiscoverable')}</Copy><Copy>{peerStatus.url}</Copy>
      <Copy>{t(peerStatus.paired ? 'peerPaired' : 'peerWaiting')}</Copy>
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
