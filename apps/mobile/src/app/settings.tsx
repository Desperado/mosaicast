import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../state/app';
import { BackHeader, Button, Card, Copy, InfoDialog, Screen, styles } from '../components/ui';

export default function Settings() {
  const { t, ready, preferences, savePreferences } = useApp();
  const { width, height } = useWindowDimensions();
  const [aboutOpen, setAboutOpen] = useState(false);
  if (!ready) return <Screen><Copy>{t('loading')}</Copy></Screen>;
  return <Screen header={<BackHeader title={t('settings')}/>} footer={<View style={[styles.row, { alignItems: 'stretch', gap: 8 }]}>
    <View style={{ flex: 1 }}><Button label={t('connection')} onPress={() => router.push('/connection')}/></View>
    <View style={{ flex: 1 }}><Button label={t('about')} onPress={() => setAboutOpen(true)}/></View>
    <View style={{ flex: 1 }}><Button label={t('showWelcome')} onPress={() => router.push('/?welcome=1')}/></View>
  </View>}>
    <View style={{ flexDirection: width > height ? 'row' : 'column', gap: 8 }}>
      <Card style={width > height ? { flex: 1 } : undefined}><Copy kind="heading">{t('appearance')}</Copy><View style={[styles.row, { gap: 8, alignItems: 'stretch' }]}>
        {(['system', 'light', 'dark'] as const).map(value => <View key={value} style={{ flex: 1 }}><Button label={t(value)} selected={preferences.appearance === value} onPress={() => void savePreferences({ appearance: value })}/></View>)}
      </View></Card>
      <Card style={width > height ? { flex: 1 } : undefined}><Copy kind="heading">{t('language')}</Copy><View style={[styles.row, { gap: 8, alignItems: 'stretch' }]}>
        {(['system', 'en', 'uk'] as const).map(value => <View key={value} style={{ flex: 1 }}><Button label={t(value === 'en' ? 'english' : value === 'uk' ? 'ukrainian' : 'system')} selected={preferences.language === value} onPress={() => void savePreferences({ language: value })}/></View>)}
      </View></Card>
    </View>
    <InfoDialog visible={aboutOpen} title={t('about')} onClose={() => setAboutOpen(false)}><Copy>{t('aboutBody')}</Copy></InfoDialog>
  </Screen>;
}
