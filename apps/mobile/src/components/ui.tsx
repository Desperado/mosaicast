import { useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle, type TextProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@mosaicast/design';
import { router } from 'expo-router';
import { useApp } from '../state/app';
import { Icon, type IconName } from './icon';

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stack: { gap: 16 }, smallStack: { gap: 8 },
});

export function Copy({ children, kind = 'body', color, style, accessibilityRole, lines }: { children: ReactNode; kind?: 'body' | 'title' | 'heading' | 'small' | 'label'; color?: string; style?: StyleProp<import('react-native').TextStyle>; accessibilityRole?: TextProps['accessibilityRole']; lines?: number }) {
  const { colors } = useApp();
  return <Text accessibilityRole={accessibilityRole} numberOfLines={lines} style={[{ color: color ?? (kind === 'small' || kind === 'label' ? colors.muted : colors.text) }, typography[kind], style]}>{children}</Text>;
}
const typography = StyleSheet.create({
  body: { fontSize: 16, lineHeight: 24 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.9 },
  heading: { fontSize: 21, lineHeight: 28, fontWeight: '600', letterSpacing: -0.4 },
  small: { fontSize: 13, lineHeight: 19 }, label: { fontSize: 11, lineHeight: 16, letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: '600' },
});

export function Button({ label, accessibilityLabel, onPress, primary = false, disabled = false, pending = false, working = false, selected = false, icon }: { label: string; accessibilityLabel?: string; onPress: () => void; primary?: boolean; disabled?: boolean; pending?: boolean; working?: boolean; selected?: boolean; icon?: IconName }) {
  const { colors } = useApp();
  const foreground = primary ? colors.accentText : selected ? colors.accent : colors.text;
  return <Pressable aria-busy={working} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled: disabled || pending, busy: working, selected }} disabled={disabled || pending} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, borderWidth: primary ? 0 : 1, borderColor: selected ? colors.accent : colors.border,
      backgroundColor: primary ? colors.primary : selected ? colors.tint : colors.surface, opacity: disabled ? 0.4 : pressed ? 0.7 : 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 })}>
    {working && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 2, borderRadius: 13, borderColor: colors.accent }]}/>}
    {icon && <Icon name={icon} color={foreground}/>}<Text style={{ color: foreground, fontSize: 15, lineHeight: 21, fontWeight: '600', flexShrink: 1, textAlign: 'center' }}>{label}</Text>
  </Pressable>;
}

export function IconButton({ name, label, onPress, disabled, pending, working = false, primary = false, size = 48 }: { name: IconName; label: string; onPress: () => void; disabled?: boolean; pending?: boolean; working?: boolean; primary?: boolean; size?: number }) {
  const { colors } = useApp();
  return <Pressable aria-busy={working} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!pending, busy: working }} disabled={disabled || pending} onPress={onPress}
    style={({ pressed }) => ({ minWidth: size, minHeight: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
      borderWidth: primary ? 0 : 1, borderColor: colors.border, backgroundColor: primary ? colors.primary : colors.surface, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 })}>
    {working && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 2, borderRadius: size / 2, borderColor: colors.accent }]}/>}
    <Icon name={name} color={primary ? colors.accentText : colors.text} size={primary ? 28 : 22}/>
  </Pressable>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useApp();
  return <View style={[{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, gap: 8 }, style]}>{children}</View>;
}
export function DemoBadge() {
  const { colors, t } = useApp();
  return <View style={{ backgroundColor: colors.tint, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}><Copy kind="small" color={colors.accent}>{t('demo')}</Copy></View>;
}
export function BackHeader({ title }: { title: string }) {
  const { t, real } = useApp();
  return <View style={styles.spread}><IconButton name="back" label={t('back')} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}/><Copy kind="small" style={{ flex: 1, textAlign: 'center' }}>{title}</Copy>{!real && <DemoBadge/>}</View>;
}
export function Screen({ children, tab = false, header, footer }: { children: ReactNode; tab?: boolean; header?: ReactNode; footer?: ReactNode }) {
  const { colors, storageError, savePreferences, retryLoadPreferences, resetPreferences, t } = useApp();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, minHeight: 0 }}>
    <View testID="screen-frame" style={{ flex: 1, minHeight: 0, padding: height < 740 ? spacing.small : spacing.medium, paddingBottom: (height < 740 ? spacing.small : spacing.medium) + (tab ? 0 : insets.bottom), gap: spacing.small, maxWidth: width > height ? 960 : 600, width: '100%', alignSelf: 'center' }}>
      {header}
      {storageError && <Card>
        <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{t(storageError)}</Text>
        {storageError === 'loadError'
          ? <><Button label={t('retryLoad')} onPress={() => void retryLoadPreferences()}/><Button label={t('resetPreferences')} onPress={() => void resetPreferences()}/></>
          : <Button label={t('retrySave')} onPress={() => void savePreferences({})}/>}
      </Card>}
      {fontScale > 1.35 ? <ScrollView contentContainerStyle={{ flexGrow: 1, gap: spacing.small }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        : <View testID="screen-content" style={{ flex: 1, minHeight: 0, gap: spacing.small }}>{children}</View>}
      {footer}
    </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

// Only collections scroll. Navigation and page actions remain outside this area.
export function ScrollArea({ children, resetKey }: { children: ReactNode; resetKey?: string | number }) {
  const ref = useRef<ScrollView>(null);
  useEffect(() => { ref.current?.scrollTo({ y: 0, animated: false }); }, [resetKey]);
  return <ScrollView ref={ref} testID="collection-scroll" style={{ flex: 1, minHeight: 0 }} bounces={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
    contentContainerStyle={{ gap: spacing.small, paddingBottom: spacing.small }}>{children}</ScrollView>;
}

export function InfoDialog({ visible, title, children, onClose }: { visible: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const { colors, t } = useApp();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: spacing.medium, backgroundColor: '#00000088' }}>
      <View accessibilityViewIsModal style={{ maxHeight: '100%', maxWidth: 560, width: '100%', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 16, padding: spacing.medium, gap: spacing.medium }}>
        <View style={styles.spread}><Copy kind="heading" style={{ flex: 1 }}>{title}</Copy><IconButton name="close" label={t('close')} onPress={onClose}/></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.small }}>{children}</ScrollView>
      </View>
    </SafeAreaView>
  </Modal>;
}

export function ErrorNotice({ message, children }: { message: string; children?: ReactNode }) {
  const { t } = useApp();
  const [open, setOpen] = useState(true);
  return <>
    <Button label={t('errorDetails')} onPress={() => setOpen(true)}/>
    <InfoDialog visible={open} title={t('errorDetails')} onClose={() => setOpen(false)}>
      <Copy accessibilityRole="alert">{message}</Copy>{children}
    </InfoDialog>
  </>;
}

export function Mosaic({ compact = false, variant = 0, mark = false, fill = false }: { compact?: boolean; variant?: number; mark?: boolean; fill?: boolean }) {
  const { colors } = useApp();
  const palette = variant === 0 ? ['#213646', '#527d90', '#d4cab0', '#b39373'] : ['#41465c', '#a3aba2', '#dbcfb8', '#7b8f98'];
  const tiles = mark ? [colors.primary, colors.text, colors.accent, colors.background] : [0,1,2,1,3,0,2,3,1,2,0,1,3,2,3,0].map(i => palette[i]);
  return <View accessible={false} style={{ width: mark ? 94 : compact ? 64 : '100%', maxWidth: mark ? 94 : compact ? 64 : fill ? 440 : 250, aspectRatio: 1, alignSelf: 'center', borderRadius: mark ? 0 : compact ? 10 : 14, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap', gap: mark ? 6 : 0 }}>
    {tiles.map((color, i) => <View key={i} style={{ width: mark ? 44 : '25%', height: mark ? 44 : '25%', backgroundColor: color, borderRadius: mark ? 10 : 0, borderWidth: mark && i === 3 ? 1 : 0, borderStyle: 'dashed', borderColor: colors.muted }}/>) }
  </View>;
}
