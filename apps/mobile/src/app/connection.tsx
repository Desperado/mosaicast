import { useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { privateIPv4 } from '@mosaicast/musiccast';
import { useApp } from '../state/app';
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
  const busy = connecting || deviceState.busy;
  async function submit() {
    if (busy) return;
    const host = address.trim();
    if (!privateIPv4(host)) { setInvalid(true); return; }
    setConnecting(true); setFailed(false);
    const success = await connect(host);
    setConnecting(false); setFailed(!success);
    if (success) router.replace('/(tabs)/listen');
  }
  return <Screen>
    <BackHeader title={t('connection')}/>
    <View style={styles.smallStack}><Copy kind="title">{t('connectionTitle')}</Copy><Copy color={colors.muted}>{t('connectionBody')}</Copy></View>
    <Card style={{ backgroundColor: colors.tint }}><Copy kind="heading">{t('localTitle')}</Copy><Copy kind="small">{t('localBody')}</Copy><Copy kind="small">{t('networkHint')}</Copy></Card>
    {Platform.OS === 'web' && <Card><Copy kind="heading">{t('bridgeTitle')}</Copy><Copy kind="small">{t('bridgeHint')}</Copy></Card>}
    <View style={styles.smallStack}>
      <Copy>{t('ipAddress')}</Copy>
      <TextInput accessibilityLabel={t('ipAddress')} accessibilityHint={t('ipHint')} value={address} editable={!busy} placeholder="192.168.1.40" placeholderTextColor={colors.muted}
        autoCapitalize="none" autoCorrect={false} keyboardType="decimal-pad" returnKeyType="done" maxLength={64} onSubmitEditing={() => void submit()}
        onChangeText={value => { setAddress(value); setInvalid(false); setFailed(false); }}
        style={{ minHeight: 56, padding: 16, fontSize: 18, borderRadius: 12, borderWidth: 1, borderColor: invalid ? colors.accent : colors.border, color: colors.text, backgroundColor: colors.surface }}/>
      <Copy kind="small">{t(invalid ? 'invalidIP' : 'ipHint')}</Copy>
      {failed && <Copy accessibilityRole="alert">{t(deviceState.error ?? 'connectError')}</Copy>}
    </View>
    <Button label={t(busy ? 'connecting' : 'connectByIP')} primary disabled={busy || !address.trim()} onPress={() => void submit()}/>
    <View style={{ flex: 1 }}/>
    <Button label={t('tryDemo')} disabled={busy} onPress={() => { startDemo(); router.replace('/(tabs)/listen'); }}/>
  </Screen>;
}
