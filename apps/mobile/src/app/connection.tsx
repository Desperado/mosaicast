import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { privateIPv4 } from '@mosaicast/musiccast';
import { useApp } from '../state/app';
import { BackHeader, Button, Card, Copy, Screen, styles } from '../components/ui';

export default function Connection() {
  const app = useApp();
  // Mount after hydration so the draft starts with the saved address.
  if (!app.ready) return <Screen><Copy>{app.t('loading')}</Copy></Screen>;
  return <ConnectionForm {...app}/>;
}

function ConnectionForm({ colors, t, preferences, savePreferences }: Pick<ReturnType<typeof useApp>, 'colors' | 't' | 'preferences' | 'savePreferences'>) {
  const [address, setAddress] = useState(preferences.address);
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  async function save() {
    if (saving) return;
    const host = address.trim();
    if (!privateIPv4(host)) { setInvalid(true); return; }
    setSaving(true); setSaved(false);
    const success = await savePreferences({ address: host });
    setSaved(success); setSaving(false);
  }
  function startDemo() {
    void savePreferences({ demoStarted: true });
    router.replace('/(tabs)/listen');
  }
  return <Screen>
    <BackHeader title={t('connection')}/>
    <View style={styles.smallStack}><Copy kind="title">{t('connectionTitle')}</Copy><Copy color={colors.muted}>{t('connectionBody')}</Copy></View>
    <Card style={{ backgroundColor: colors.tint }}><Copy kind="heading">{t('previewTitle')}</Copy><Copy kind="small">{t('previewBody')}</Copy></Card>
    <View style={styles.smallStack}>
      <Copy>{t('ipAddress')}</Copy>
      <TextInput accessibilityLabel={t('ipAddress')} accessibilityHint={t('ipHint')} value={address} editable={!saving} placeholder="192.168.1.40" placeholderTextColor={colors.muted}
        autoCapitalize="none" autoCorrect={false} keyboardType="decimal-pad" returnKeyType="done" maxLength={64} onSubmitEditing={() => void save()}
        onChangeText={value => { setAddress(value); setInvalid(false); setSaved(false); }}
        style={{ minHeight: 56, padding: 16, fontSize: 18, borderRadius: 12, borderWidth: 1, borderColor: invalid ? colors.accent : colors.border, color: colors.text, backgroundColor: colors.surface }}/>
      <Copy kind="small">{t(invalid ? 'invalidIP' : 'ipHint')}</Copy>
      {saved && <Copy color={colors.positive}>{t('addressSaved')}</Copy>}
    </View>
    <Button label={t('saveAddress')} primary disabled={saving || !address.trim()} onPress={() => void save()}/>
    <Card><Copy kind="heading">{t('localTitle')}</Copy><Copy kind="small">{t('localBody')}</Copy></Card>
    <View style={{ flex: 1 }}/>
    <Button label={t('tryDemo')} onPress={startDemo}/>
  </Screen>;
}
