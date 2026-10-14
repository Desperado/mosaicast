import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useApp } from '../state/app';
import { Icon, type IconName } from './icon';

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stack: { gap: 16 }, smallStack: { gap: 8 },
});

export function Copy({ children, kind = 'body', color, style }: { children: ReactNode; kind?: 'body' | 'title' | 'heading' | 'small' | 'label'; color?: string; style?: StyleProp<import('react-native').TextStyle> }) {
  const { colors } = useApp();
  return <Text style={[{ color: color ?? (kind === 'small' || kind === 'label' ? colors.muted : colors.text) }, typography[kind], style]}>{children}</Text>;
}
const typography = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.9 },
  heading: { fontSize: 21, lineHeight: 28, fontWeight: '600', letterSpacing: -0.4 },
  small: { fontSize: 13, lineHeight: 19 }, label: { fontSize: 11, lineHeight: 16, letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: '600' },
});

export function Button({ label, onPress, primary = false, disabled = false, selected = false, icon }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; selected?: boolean; icon?: IconName }) {
  const { colors } = useApp();
  const foreground = primary ? colors.accentText : selected ? colors.accent : colors.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 13, borderWidth: primary ? 0 : 1, borderColor: selected ? colors.accent : colors.border,
      backgroundColor: primary ? colors.primary : selected ? colors.tint : colors.surface, opacity: disabled ? 0.4 : pressed ? 0.7 : 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 })}>
    {icon && <Icon name={icon} color={foreground}/>}<Text style={{ color: foreground, fontSize: 15, lineHeight: 21, fontWeight: '600', flexShrink: 1, textAlign: 'center' }}>{label}</Text>
  </Pressable>;
}

export function IconButton({ name, label, onPress, disabled, primary = false, size = 48 }: { name: IconName; label: string; onPress: () => void; disabled?: boolean; primary?: boolean; size?: number }) {
  const { colors } = useApp();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minWidth: size, minHeight: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
      borderWidth: primary ? 0 : 1, borderColor: colors.border, backgroundColor: primary ? colors.primary : colors.surface, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 })}>
    <Icon name={name} color={primary ? colors.accentText : colors.text} size={primary ? 28 : 22}/>
  </Pressable>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useApp();
  return <View style={[{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 18, gap: 12 }, style]}>{children}</View>;
}
export function DemoBadge() {
  const { colors, t } = useApp();
  return <View style={{ backgroundColor: colors.tint, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}><Copy kind="small" color={colors.accent}>{t('demo')}</Copy></View>;
}
export function BackHeader({ title }: { title: string }) {
  const { t } = useApp();
  return <View style={styles.spread}><IconButton name="back" label={t('back')} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}/><Copy kind="small">{title}</Copy><DemoBadge/></View>;
}
export function Screen({ children }: { children: ReactNode }) {
  const { colors, storageError, savePreferences, t } = useApp();
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 36, gap: 24, flexGrow: 1, maxWidth: 600, width: '100%', alignSelf: 'center' }}>
      {storageError && <Card><Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{t(storageError)}</Text><Button label={t('retrySave')} onPress={() => void savePreferences({})}/></Card>}
      {children}
    </ScrollView>
  </SafeAreaView>;
}

export function Mosaic({ compact = false, variant = 0, mark = false }: { compact?: boolean; variant?: number; mark?: boolean }) {
  const { colors } = useApp();
  const palette = variant === 0 ? ['#213646', '#527d90', '#d4cab0', '#b39373'] : ['#41465c', '#a3aba2', '#dbcfb8', '#7b8f98'];
  const tiles = mark ? [colors.primary, colors.text, colors.accent, colors.background] : [0,1,2,1,3,0,2,3,1,2,0,1,3,2,3,0].map(i => palette[i]);
  return <View accessible={false} style={{ width: mark ? 94 : compact ? 64 : '100%', maxWidth: mark ? 94 : compact ? 64 : 250, aspectRatio: 1, alignSelf: 'center', borderRadius: mark ? 0 : compact ? 10 : 14, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', gap: mark ? 6 : 0 }}>
    {tiles.map((color, i) => <View key={i} style={{ width: mark ? 44 : '25%', height: mark ? 44 : '25%', backgroundColor: color, borderRadius: mark ? 10 : 0, borderWidth: mark && i === 3 ? 1 : 0, borderStyle: 'dashed', borderColor: colors.muted }}/>) }
  </View>;
}
