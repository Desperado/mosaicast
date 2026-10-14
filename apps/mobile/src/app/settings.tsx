import { View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../state/app';
import { BackHeader, Button, Card, Copy, Screen, styles } from '../components/ui';

export default function Settings() {
  const { t, preferences, savePreferences } = useApp();
  return <Screen>
    <BackHeader title={t('settings')}/>
    <View style={styles.smallStack}><Copy kind="title">{t('settings')}</Copy><Copy kind="small">{t('settingsBody')}</Copy></View>
    <Card><Copy kind="heading">{t('appearance')}</Copy><View style={styles.stack}>
      {(['system', 'light', 'dark'] as const).map(value => <Button key={value} label={t(value)} selected={preferences.appearance === value} onPress={() => void savePreferences({ appearance: value })}/>)}
    </View></Card>
    <Card><Copy kind="heading">{t('language')}</Copy>
      {(['system', 'en', 'uk'] as const).map(value => <Button key={value} label={t(value === 'en' ? 'english' : value === 'uk' ? 'ukrainian' : 'system')} selected={preferences.language === value} onPress={() => void savePreferences({ language: value })}/>)}
      <Copy kind="small">{t('preferenceHint')}</Copy>
    </Card>
    <Button label={t('connection')} icon="connection" onPress={() => router.push('/connection')}/>
    <Card><Copy kind="heading">{t('about')}</Copy><Copy kind="small">{t('aboutBody')}</Copy></Card>
    <Button label={t('showWelcome')} onPress={() => router.push('/?welcome=1')}/>
  </Screen>;
}
