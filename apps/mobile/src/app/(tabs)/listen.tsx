import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { connectivityLabel, sourceLabel } from '@mosaicast/i18n';
import { useApp } from '../../state/app';
import { Button, Card, Copy, DemoBadge, IconButton, Mosaic, Screen, styles } from '../../components/ui';
import { Icon } from '../../components/icon';
import { Sources } from '../../components/sources';

export default function Listen() {
  const { colors, t, locale, snapshot, activeRoom, busy, commandError, execute } = useApp();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  if (!snapshot) return <Screen><Copy>{t(commandError ? 'error' : 'loading')}</Copy></Screen>;
  const on = snapshot.status.power === 'on';
  const track = snapshot.track;
  const range = snapshot.features.volumeRange;
  const volume = snapshot.status.volume ?? 0;
  const ratio = range && range.max > range.min ? (volume - range.min) / (range.max - range.min) : 0;
  const input = snapshot.features.sources.find(source => source.id === snapshot.status.input);
  return <Screen>
    <View style={styles.spread}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('rooms')} onPress={() => router.navigate('/(tabs)/rooms')} style={{ flex: 1, minHeight: 48, justifyContent: 'center', gap: 2 }}>
        <View style={styles.row}><Copy kind="heading">{t(activeRoom)}</Copy><Icon name="chevron" color={colors.muted} size={16}/></View>
        <Copy kind="small">{t('exampleDevice')} · {t(on ? 'simulated' : 'standby')}</Copy>
      </Pressable>
      <IconButton name="power" label={t(on ? 'standby' : 'powerOn')} disabled={busy} onPress={() => void execute({ type: 'power', value: on ? 'standby' : 'on' })}/>
      <IconButton name="settings" label={t('settings')} onPress={() => router.push('/settings')}/>
    </View>
    <View style={styles.row}><DemoBadge/><Copy kind="small" style={{ flex: 1 }}>{t('demoNotice')}</Copy></View>
    {commandError && <Copy>{t('error')}</Copy>}
    {!on && <Card><Copy kind="heading">{t('standbyTitle')}</Copy><Copy kind="small">{t('standbyBody')}</Copy><Button label={t('powerOn')} primary disabled={busy} onPress={() => void execute({ type: 'power', value: 'on' })}/></Card>}
    <View style={{ gap: 20, paddingTop: 4 }}>
      {track ? <Mosaic variant={activeRoom === 'studio' ? 1 : 0}/> : <View style={{ height: 180, alignItems: 'center', justifyContent: 'center', gap: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border }}><Icon name="music" color={colors.muted} size={40}/><Copy kind="small">{t('noTrack')}</Copy></View>}
      <View style={styles.smallStack}>
        <Copy kind="label">{t('nowPlaying')}{track ? ` · ${t(track.playback === 'play' ? 'playing' : track.playback === 'pause' ? 'paused' : 'stopped')}` : ''}</Copy>
        <Copy kind="heading">{track?.title ?? t('noTrack')}</Copy>
        <Copy color={colors.muted}>{track ? `${track.artist} · ${track.album}` : on ? t('noTrackBody') : t('standbyBody')}</Copy>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('sources')} onPress={() => setSourcesOpen(true)}
        style={({ pressed }) => ({ alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 28, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}>
        <Copy kind="small">{t('source')}</Copy><Copy style={{ fontWeight: '600', fontSize: 15 }}>{sourceLabel(locale, snapshot.status.input, input?.name ?? snapshot.status.input)}</Copy><Icon name="chevron" color={colors.muted} size={16}/>
      </Pressable>
      {track && <View style={[styles.row, { alignSelf: 'center', gap: 24, paddingVertical: 4 }]}>
        <IconButton name="previous" label={t('previousTrack')} disabled={busy || !on} onPress={() => void execute({ type: 'playback', value: 'previous' })}/>
        <IconButton name={track.playback === 'play' ? 'pause' : 'play'} label={t(track.playback === 'play' ? 'pause' : 'play')} size={72} primary disabled={busy || !on}
          onPress={() => void execute({ type: 'playback', value: track.playback === 'play' ? 'pause' : 'play' })}/>
        <IconButton name="next" label={t('nextTrack')} disabled={busy || !on} onPress={() => void execute({ type: 'playback', value: 'next' })}/>
      </View>}
    </View>
    <Card>
      <View style={[styles.spread, { flexWrap: 'wrap' }]}>
        <IconButton name={snapshot.status.mute ? 'muted' : 'volume'} label={t(snapshot.status.mute ? 'unmute' : 'mute')} disabled={busy || !on} onPress={() => void execute({ type: 'mute', value: !snapshot.status.mute })}/>
        <View style={{ flex: 1, minWidth: 72 }}><Copy kind="title">{volume}<Copy kind="small"> {t('of')} {range?.max}</Copy></Copy><Copy kind="label">{t('volume')}</Copy></View>
        <IconButton name="minus" label={`${t('volume')} −`} disabled={busy || !on || volume <= (range?.min ?? 0)} onPress={() => void execute({ type: 'volume', value: 'down' })}/>
        <IconButton name="plus" label={`${t('volume')} +`} disabled={busy || !on || volume >= (range?.max ?? 0)} onPress={() => void execute({ type: 'volume', value: 'up' })}/>
      </View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={t('volume')} accessibilityValue={{ min: range?.min, max: range?.max, now: volume }} style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
        <View style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, height: '100%', backgroundColor: colors.accent }}/>
      </View>
      <Copy kind="small">{t('demoVolume')}</Copy>
    </Card>
    <Card><Copy kind="heading">{t('capabilities')}</Copy><Copy kind="small">{t('capabilitiesHint')}</Copy>
      <Copy>{snapshot.features.connectivity.map(label => connectivityLabel(locale, label)).join(' · ')}</Copy>
    </Card>
    <Sources visible={sourcesOpen} onClose={() => setSourcesOpen(false)}/>
  </Screen>;
}
