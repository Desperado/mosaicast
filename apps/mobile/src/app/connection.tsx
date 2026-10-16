import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Platform, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { discoverMusicCast, discoveryPrefix, privateIPv4, type DiscoveredDevice } from '@mosaicast/musiccast';
import { useApp } from '../state/app';
import { normalizeAddress } from '../state/address';
import { localSearchAddress } from '../state/discovery';
import { BackHeader, Button, Card, Copy, Screen, styles } from '../components/ui';

export default function Connection() {
  const app = useApp();
  if (!app.ready) return <Screen><Copy>{app.t('loading')}</Copy></Screen>;
  return <ConnectionForm {...app}/>;
}

function ConnectionForm({ colors, t, preferences, connect, deviceState, startDemo }: Pick<ReturnType<typeof useApp>, 'colors' | 't' | 'preferences' | 'connect' | 'deviceState' | 'startDemo'>) {
  const [address, setAddress] = useState(preferences.address);
  const [invalid, setInvalid] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'done' | 'cancelled' | 'error'>('idle');
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [range, setRange] = useState('');
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
    setSearchState('searching'); setDevices([]); setRange(''); setFailed(false);
    try {
      const local = await localSearchAddress();
      if (controller.signal.aborted) return;
      setRange(`${discoveryPrefix(local)}.1–254`);
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
  return <Screen>
    <BackHeader title={t('connection')}/>
    <View style={styles.smallStack}><Copy kind="title">{t('connectionTitle')}</Copy><Copy color={colors.muted}>{t('connectionBody')}</Copy></View>
    <Card style={{ backgroundColor: colors.tint }}><Copy kind="heading">{t('localTitle')}</Copy><Copy kind="small">{t('localBody')}</Copy><Copy kind="small">{t('networkHint')}</Copy></Card>
    {Platform.OS === 'web' && <Card><Copy kind="heading">{t('bridgeTitle')}</Copy><Copy kind="small">{t('bridgeHint')}</Copy></Card>}
    {Platform.OS !== 'web' ? <Card>
      <Copy kind="heading">{t('discoveryTitle')}</Copy>
      <Copy kind="small">{t('discoveryHint')}</Copy>
      {range && <Copy kind="small">{t('discoveryRange')}: {range}</Copy>}
      <Button label={t(searchState === 'searching' ? 'cancelSearch' : 'findDevices')} disabled={busy}
        onPress={() => searchState === 'searching' ? cancelSearch() : void startSearch()}/>
      {searchState === 'searching' && <Copy>{t('searchingDevices')}</Copy>}
      {searchState === 'cancelled' && <Copy kind="small">{t('searchCancelled')}</Copy>}
      {searchState === 'error' && <Copy accessibilityRole="alert">{t('discoveryError')}</Copy>}
      {searchState === 'done' && devices.length === 0 && <Copy accessibilityRole="alert">{t('noDevicesFound')}</Copy>}
      {devices.length > 0 && <Copy kind="small">{t('chooseDiscovered')}</Copy>}
      {devices.map(device => <Button key={device.host} label={`${device.model} · ${device.host}`} disabled={busy} selected={address === device.host}
        onPress={() => { cancelSearch(); setAddress(device.host); setInvalid(false); setFailed(false); }}/>) }
    </Card> : <Copy kind="small">{t('discoveryNativeOnly')}</Copy>}
    <View style={styles.smallStack}>
      <Copy>{t('ipAddress')}</Copy>
      <TextInput accessibilityLabel={t('ipAddress')} accessibilityHint={t('ipHint')} value={address} editable={!busy} placeholder="192.168.1.40" placeholderTextColor={colors.muted}
        autoCapitalize="none" autoCorrect={false} autoComplete="off" keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'url'} returnKeyType="done" maxLength={64} onSubmitEditing={() => void submit()}
        onChangeText={value => { cancelSearch(); setAddress(normalizeAddress(value)); setInvalid(false); setFailed(false); }}
        style={{ minHeight: 56, padding: 16, fontSize: 18, borderRadius: 12, borderWidth: 1, borderColor: invalid ? colors.accent : colors.border, color: colors.text, backgroundColor: colors.surface }}/>
      <Copy kind="small">{t(invalid ? 'invalidIP' : 'ipHint')}</Copy>
      {failed && <Copy accessibilityRole="alert">{t(deviceState.error ?? 'connectError')}</Copy>}
    </View>
    <Button label={t(busy ? 'connecting' : 'connectByIP')} primary disabled={busy || !address.trim()} onPress={() => void submit()}/>
    <View style={{ flex: 1 }}/>
    <Button label={t('tryDemo')} disabled={busy} onPress={() => { cancelSearch(); startDemo(); router.replace('/(tabs)/listen'); }}/>
  </Screen>;
}
