import { View, Text } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../state/app';
import { Button, Copy, Mosaic, Screen, styles } from '../components/ui';

export default function Welcome() {
  const { ready, preferences, savePreferences, colors, t } = useApp();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  if (!ready) return <Screen><Copy>{t('loading')}</Copy></Screen>;
  if (preferences.demoStarted && welcome !== '1') return <Redirect href="/(tabs)/listen"/>;
  function startDemo() {
    void savePreferences({ demoStarted: true });
    router.replace('/(tabs)/listen');
  }
  return <Screen>
    <View style={[styles.row, { justifyContent: 'flex-end', flexWrap: 'wrap' }]}>
      <Button label="English" selected={preferences.language === 'en'} onPress={() => void savePreferences({ language: 'en' })}/>
      <Button label="Українська" selected={preferences.language === 'uk'} onPress={() => void savePreferences({ language: 'uk' })}/>
    </View>
    <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 48, gap: 24 }}>
      <Mosaic mark/>
      <Text accessibilityLabel="Mosaicast" style={{ color: colors.text, fontSize: 44, fontWeight: '700', letterSpacing: -2, textAlign: 'center' }}>Mos<Text style={{ color: colors.accent }}>AI</Text>cast</Text>
      <Copy kind="heading" style={{ textAlign: 'center', maxWidth: 290, alignSelf: 'center' }}>{t('tagline')}</Copy>
      <Copy color={colors.muted} style={{ textAlign: 'center', maxWidth: 310, alignSelf: 'center' }}>{t('welcomeBody')}</Copy>
    </View>
    <View style={styles.stack}>
      <Button label={t('tryDemo')} primary onPress={startDemo}/>
      <Button label={t('connectByIP')} icon="connection" onPress={() => router.push('/connection')}/>
      <Copy kind="small" style={{ textAlign: 'center' }}>{t('independent')}</Copy>
    </View>
  </Screen>;
}
