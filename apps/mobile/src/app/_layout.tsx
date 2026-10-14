import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from '../state/app';

export default function Layout() {
  return <AppProvider><Navigation/></AppProvider>;
}
function Navigation() {
  const { theme, colors } = useApp();
  return <><StatusBar style={theme === 'dark' ? 'light' : 'dark'}/><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}/></>;
}
