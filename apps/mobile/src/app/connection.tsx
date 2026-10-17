import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Platform, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { discoverMusicCast, privateIPv4, type DiscoveredDevice } from '@mosaicast/musiccast';
import { useApp } from '../state/app';
import { normalizeAddress } from '../state/address';
import { localSearchAddress } from '../state/discovery';
import { BackHeader, Button, Copy, InfoDialog, Screen, ScrollArea, styles } from '../components/ui';
import { IPAddressInput } from '../components/ip-address-input';

export default function Connection() {
  const app = useApp();
  if (!app.ready) return <Screen><Copy>{app.t('loading')}</Copy></Screen>;
  return <ConnectionForm {...app}/>;
}

function ConnectionForm({ t, preferences, connect, deviceState, startDemo }: Pick<ReturnType<typeof useApp>, 't' | 'preferences' | 'connect' | 'deviceState' | 'startDemo'>) {
  const [address, setAddress] = useState(preferences.address);
  const [invalid, setInvalid] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'done' | 'cancelled' | 'error'>('idle');
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const search = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const busy = connecting || deviceState.busy;
  const cancelSearch = useCallback(() => {
    if (!search.current) return;
    search.current.abort();
    search.current = null;
    setSearchState('cancelled');
  }, []);
  useFocusEffect(useCallback(() => cancelSearch, [cancelSearch]));
  useEffect(() => {
    // iOS permission prompts can make the app inactive; only backgrounding cancels.
    const subscription = AppState.addEventListener('change', state => { if (state === 'background') cancelSearch(); });
    return () => subscription.remove();
  }, [cancelSearch]);

  async function startSearch() {
    if (busy || submitting.current || search.current) return;
    Keyboard.dismiss();
    const controller = new AbortController();
    search.current = controller;
    setSearchState('searching'); setDevices([]); setFailed(false);
    try {
      const local = await localSearchAddress();
      if (controller.signal.aborted) return;
      await discoverMusicCast(local, {
        signal: controller.signal,
        onDevice: device => { if (!controller.signal.aborted) setDevices(previous => [...previous, device]); },
      });
      if (!controller.signal.aborted) setSearchState('done');
    } catch {
      if (!controller.signal.aborted) setSearchState('error');
    } finally {
      if (search.current === controller) search.current = null;
    }
  }

  async function submit() {
    if (busy || submitting.current) return;
    const host = normalizeAddress(address);
    setAddress(host);
    if (!privateIPv4(host)) { setInvalid(true); return; }
    cancelSearch(); Keyboard.dismiss();
    submitting.current = true;
    setConnecting(true); setFailed(false);
    try {
      const success = await connect(host);
      setFailed(!success);
      if (success) router.replace('/(tabs)/listen');
    } finally {
      submitting.current = false;
      setConnecting(false);
    }
  }
  return <Screen header={<BackHeader title={t('connection')}/>} footer={<View style={styles.smallStack}>
    <View style={[styles.row, { gap: 8 }]}>
      <View style={{ flex: 1 }}><Button label={t('tryDemo')} disabled={busy} onPress={() => { cancelSearch(); startDemo(); router.replace('/(tabs)/listen'); }}/></View>
      <View style={{ flex: 1 }}><Button label={t('connectionHelp')} onPress={() => { Keyboard.dismiss(); setInfoOpen(true); }}/></View>
    </View>
  </View>}>
    <Button label={t('companion')} primary disabled={busy} onPress={() => { cancelSearch(); router.push('/companion'); }}/>
    <View style={styles.smallStack}>
      <Copy>{t('ipAddress')}</Copy>
      <IPAddressInput value={address} busy={busy} invalid={invalid} onSubmit={() => void submit()}
        onChange={value => { cancelSearch(); setAddress(value); setInvalid(false); setFailed(false); }}/>
      {invalid && <Copy kind="small" accessibilityRole="alert">{t('invalidIP')}</Copy>}
      {failed && <Copy accessibilityRole="alert">{t(deviceState.error ?? 'connectError')}</Copy>}
      <Button label={t(busy ? 'connecting' : 'connectByIP')} disabled={busy || !address.trim()} onPress={() => void submit()}/>
    </View>
    {Platform.OS !== 'web' && <>
      <Button label={t(searchState === 'searching' ? 'cancelSearch' : 'findDevices')} disabled={busy}
        onPress={() => searchState === 'searching' ? cancelSearch() : void startSearch()}/>
      {searchState === 'searching' && <Copy kind="small">{t('searchingDevices')}</Copy>}
      {searchState === 'error' && <Copy accessibilityRole="alert">{t('discoveryError')}</Copy>}
      {searchState === 'done' && devices.length === 0 && <Copy accessibilityRole="alert">{t('noDevicesFound')}</Copy>}
      <ScrollArea>{devices.map(device => <Button key={device.host} label={`${device.model} · ${device.host}`} disabled={busy} selected={address === device.host}
        onPress={() => { cancelSearch(); setAddress(device.host); setInvalid(false); setFailed(false); }}/>)}</ScrollArea>
    </>}
    <InfoDialog visible={infoOpen} title={t('connectionHelp')} onClose={() => setInfoOpen(false)}>
      <Copy>{t('connectionBody')}</Copy><Copy kind="small">{t('ipHint')}</Copy>
      <Copy kind="heading">{t('localTitle')}</Copy><Copy>{t('localBody')}</Copy><Copy>{t('networkHint')}</Copy>
      {Platform.OS === 'web' && <><Copy kind="heading">{t('bridgeTitle')}</Copy><Copy>{t('bridgeHint')}</Copy></>}
    </InfoDialog>
  </Screen>;
}
