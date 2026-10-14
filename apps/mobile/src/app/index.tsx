import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { radius, spacing, themes, type Theme } from '@mosaicast/design';
import { connectivityLabel, sourceLabel, translate, type Locale, type TranslationKey } from '@mosaicast/i18n';
import { demoController, type Command, type Snapshot } from '@mosaicast/musiccast';

export default function Home() {
  const systemTheme = useColorScheme();
  const [appearance, setAppearance] = useState<Theme>();
  const theme = appearance ?? (systemTheme === 'light' ? 'light' : 'dark');
  const colors = themes[theme];
  const [locale, setLocale] = useState<Locale>('en');
  const t = (key: TranslationKey) => translate(locale, key);
  const [controller] = useState(demoController);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    controller.read().then(value => { if (active) setSnapshot(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [controller]);

  async function execute(command: Command) {
    if (busy) return;
    setBusy(true); setFailed(false);
    try { setSnapshot(await controller.execute(command)); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }

  function button(label: string, action: () => void, selected = false, disabled = false, accessibleLabel = label) {
    return <Pressable key={label} accessibilityRole="button" accessibilityLabel={accessibleLabel} accessibilityState={{ selected, disabled }} disabled={disabled}
      onPress={action} style={({ pressed }) => [styles.button, { backgroundColor: selected ? colors.accent : colors.surface, borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }]}>
      <Text style={{ color: selected ? colors.accentText : colors.text, fontSize: 16 }}>{label}</Text>
    </Pressable>;
  }

  return <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
    <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.brand, { color: colors.text }]}>MosAIcast</Text>
      <Text style={[styles.tagline, { color: colors.muted }]}>{t('tagline')}</Text>
      <View style={styles.row}>
        {button(t('light'), () => setAppearance('light'), theme === 'light')}
        {button(t('dark'), () => setAppearance('dark'), theme === 'dark')}
        {button(locale === 'en' ? 'Українська' : 'English', () => setLocale(locale === 'en' ? 'uk' : 'en'))}
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.heading, { color: colors.text }]}>{t('foundation')}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{t('demoNotice')}</Text>
      </View>
      {failed && <Text accessibilityRole="alert" style={[styles.body, { color: colors.text }]}>{t('error')}</Text>}
      {!snapshot ? <Text style={{ color: colors.text }}>{t('loading')}</Text> : <>
        <Text style={[styles.heading, { color: colors.text }]}>{t('room')}</Text>
        <Text style={[styles.tagline, { color: colors.muted }]}>{t('nowPlaying')}</Text>
        <Text style={[styles.track, { color: colors.text }]}>{snapshot.track?.title ?? t('noTrack')}</Text>
        {snapshot.track && <Text style={[styles.body, { color: colors.muted }]}>{snapshot.track.artist} · {snapshot.track.album}</Text>}
        <View style={styles.row}>
          {button(snapshot.status.power === 'on' ? t('standby') : t('powerOn'), () => void execute({ type: 'power', value: snapshot.status.power === 'on' ? 'standby' : 'on' }), false, busy)}
          {snapshot.track && button(snapshot.track.playback === 'play' ? t('pause') : t('play'), () => void execute({ type: 'playback', value: snapshot.track?.playback === 'play' ? 'pause' : 'play' }), false, busy)}
        </View>
        <Text style={[styles.body, { color: colors.text }]}>{t('volume')}: {snapshot.status.volume}</Text>
        <View style={styles.row}>
          {button('−', () => void execute({ type: 'volume', value: 'down' }), false, busy || snapshot.status.power !== 'on', `${t('volume')} −`)}
          {button('+', () => void execute({ type: 'volume', value: 'up' }), false, busy || snapshot.status.power !== 'on', `${t('volume')} +`)}
        </View>
        <Text style={[styles.heading, { color: colors.text }]}>{t('sources')}</Text>
        <View style={styles.row}>{snapshot.features.sources.map(source => button(sourceLabel(locale, source.id, source.name), () => void execute({ type: 'input', value: source.id }), snapshot.status.input === source.id, busy))}</View>
        <Text style={[styles.heading, { color: colors.text }]}>{t('capabilities')}</Text>
        <Text style={[styles.body, { color: colors.muted }]}>{snapshot.features.connectivity.map(label => connectivityLabel(locale, label)).join(' · ')}</Text>
      </>}
      <Text style={[styles.body, { color: colors.muted }]}>{t('next')}</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.large, gap: spacing.medium, width: '100%', maxWidth: 640, alignSelf: 'center' },
  brand: { fontSize: 36, fontWeight: '700', letterSpacing: -1.5 },
  tagline: { fontSize: 14 },
  heading: { fontSize: 20, fontWeight: '600' },
  track: { fontSize: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  card: { padding: spacing.large, borderRadius: radius.card, borderWidth: 1, gap: spacing.small },
  button: { minWidth: 48, minHeight: 48, paddingHorizontal: spacing.medium, paddingVertical: 12, borderRadius: radius.control, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
});
