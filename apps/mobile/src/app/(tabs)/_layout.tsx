import { Redirect, Tabs } from 'expo-router';
import { useApp } from '../../state/app';
import { Icon } from '../../components/icon';
import { Copy, Screen } from '../../components/ui';

export default function ListeningTabs() {
  const { colors, t, ready, preferences } = useApp();
  if (!ready) return <Screen><Copy>{t('loading')}</Copy></Screen>;
  if (!preferences.demoStarted) return <Redirect href="/"/>;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted,
    sceneStyle: { backgroundColor: colors.background }, tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border, minHeight: 68, paddingTop: 8 },
    tabBarLabelStyle: { fontSize: 12, paddingBottom: 4 } }}>
    <Tabs.Screen name="listen" options={{ title: t('listen'), tabBarIcon: ({ color }) => <Icon name="listen" color={color}/> }}/>
    <Tabs.Screen name="rooms" options={{ title: t('rooms'), tabBarIcon: ({ color }) => <Icon name="rooms" color={color}/> }}/>
  </Tabs>;
}
