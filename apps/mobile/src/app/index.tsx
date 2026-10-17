import { View, Text, useWindowDimensions } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useApp } from '../state/app';
import { Button, Copy, Mosaic, Screen, styles } from '../components/ui';

export default function Welcome() {
  const { ready, preferences, savePreferences, startDemo, colors, t } = useApp();
  const { width, height } = useWindowDimensions();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  if (!ready) return <Screen><Copy>{t('loading')}</Copy></Screen>;
  if (preferences.demoStarted && welcome !== '1') return <Redirect href="/(tabs)/listen"/>;

  return <Screen>
    <View style={[styles.row, { justifyContent: 'flex-end', flexWrap: 'wrap' }]}>
      <Button label="English" selected={preferences.language === 'en'} onPress={() => void savePreferences({ language: 'en' })}/>
      <Button label="Українська" selected={preferences.language === 'uk'} onPress={() => void savePreferences({ language: 'uk' })}/>
    </View>
    <View style={{ flex: 1, justifyContent: 'center', minHeight: 0, gap: 12 }}>
      {height >= 740 && <Mosaic mark/>}
      <Text accessibilityLabel="Mosaicast" style={{ color: colors.text, fontSize: 36, fontWeight: '700', letterSpacing: -2, textAlign: 'center' }}>Mos<Text style={{ color: colors.accent }}>AI</Text>cast</Text>
      <Copy kind="heading" style={{ textAlign: 'center', maxWidth: width > height ? 600 : 290, alignSelf: 'center' }}>{t('tagline')}</Copy>
      <Copy color={colors.muted} style={{ textAlign: 'center', maxWidth: width > height ? 600 : 310, alignSelf: 'center' }}>{t('welcomeBody')}</Copy>
    </View>
    <View style={styles.smallStack}>
      <Button label={t('tryDemo')} primary onPress={() => { startDemo(); router.replace('/(tabs)/listen'); }}/>
      <Button label={t('connectByIP')} icon="connection" onPress={() => router.push('/connection')}/>
      <Copy kind="small" style={{ textAlign: 'center' }}>{t('independent')}</Copy>
    </View>
  </Screen>;
}
