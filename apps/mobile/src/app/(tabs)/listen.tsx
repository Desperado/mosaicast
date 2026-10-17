import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { connectivityLabel, sourceLabel } from '@mosaicast/i18n';
import { useApp } from '../../state/app';
import { Button, Card, Copy, DemoBadge, IconButton, Mosaic, Screen, styles } from '../../components/ui';
import { Icon } from '../../components/icon';
import { Sources } from '../../components/sources';
import { BluetoothOutput } from '../../components/bluetooth-output';

export default function Listen() {
  const { colors, t, locale, snapshot, activeRoom, busy, commandError, execute, real, deviceState, refresh, controlsDisabled } = useApp();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  if (!snapshot) return <Screen><Copy>{t(commandError ?? 'loading')}</Copy><Button label={t('connectByIP')} disabled={busy} onPress={() => router.push('/connection')}/><Button label={t('settings')} onPress={() => router.push('/settings')}/></Screen>;
  const on = snapshot.status.power === 'on';
  const track = snapshot.track;
  const range = snapshot.features.volumeRange;
  const volume = snapshot.status.volume;
  const disabled = busy || controlsDisabled;
  const maxVolume = range ? Math.min(range.max, snapshot.status.maxVolume ?? range.max) : undefined;
  const canVolume = snapshot.features.controls.includes('volume') && range && volume !== undefined;
  const canMute = snapshot.features.controls.includes('mute') && typeof snapshot.status.mute === 'boolean';
  const ratio = range && maxVolume !== undefined && volume !== undefined && maxVolume > range.min ? (volume - range.min) / (maxVolume - range.min) : 0;
  const input = snapshot.features.sources.find(source => source.id === snapshot.status.input);
  const bluetoothOutput = real && snapshot.bluetooth?.enabled;
  const volumeLabel = t(bluetoothOutput ? 'speakerVolume' : 'volume');
  return <Screen>
    <View style={styles.spread}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('rooms')} onPress={() => router.navigate('/(tabs)/rooms')} style={{ flex: 1, minHeight: 48, justifyContent: 'center', gap: 2 }}>
        <View style={styles.row}><Copy kind="heading">{real ? snapshot.model : t(activeRoom === 'studio' ? 'studio' : 'livingRoom')}</Copy><Icon name="chevron" color={colors.muted} size={16}/></View>
        <Copy kind="small">{real ? deviceState.host : t('exampleDevice')} · {t(real && deviceState.phase !== 'connected' ? 'disconnected' : on ? real ? 'connected' : 'simulated' : 'standby')}</Copy>
      </Pressable>
      <IconButton name="power" label={t(on ? 'standby' : 'powerOn')} disabled={disabled || !snapshot.features.controls.includes('power')} onPress={() => void execute({ type: 'power', value: on ? 'standby' : 'on' })}/>
      <IconButton name="settings" label={t('settings')} onPress={() => router.push('/settings')}/>
    </View>
    <View style={styles.row}>{!real && <DemoBadge/>}<Copy kind="small" style={{ flex: 1 }}>{t(real ? 'deviceNotice' : 'demoNotice')}</Copy></View>
    {real && <Button label={t(busy ? 'pending' : 'refresh')} disabled={busy} onPress={() => void refresh()}/>}
    {commandError && <Copy accessibilityRole="alert">{t(commandError)}</Copy>}
    {real && !commandError && deviceState.outcome && <Copy color={colors.positive}>{t(deviceState.outcome)}</Copy>}
    {!on && <Card><Copy kind="heading">{t('standbyTitle')}</Copy><Copy kind="small">{t(real ? 'liveStandby' : 'standbyBody')}</Copy><Button label={t('powerOn')} primary disabled={disabled || !snapshot.features.controls.includes('power')} onPress={() => void execute({ type: 'power', value: 'on' })}/></Card>}
    <View style={{ gap: 20, paddingTop: 4 }}>
      {track && !real ? <Mosaic variant={activeRoom === 'studio' ? 1 : 0}/> : <View style={{ height: 180, alignItems: 'center', justifyContent: 'center', gap: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border }}><Icon name="music" color={colors.muted} size={40}/><Copy kind="small">{t(track ? 'nowPlaying' : 'noTrack')}</Copy></View>}
      <View style={styles.smallStack}>
        <Copy kind="label">{t('nowPlaying')}{track ? ` · ${t(track.playback === 'play' ? 'playing' : track.playback === 'pause' ? 'paused' : 'stopped')}` : ''}</Copy>
        <Copy kind="heading">{track?.title ?? t('noTrack')}</Copy>
        <Copy color={colors.muted}>{track ? `${track.artist} · ${track.album}` : on ? t(real ? 'liveNoTrack' : 'noTrackBody') : t(real ? 'liveStandby' : 'standbyBody')}</Copy>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('sources')} onPress={() => setSourcesOpen(true)}
        style={({ pressed }) => ({ alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 28, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}>
        <Copy kind="small">{t('source')}</Copy><Copy style={{ fontWeight: '600', fontSize: 15 }}>{sourceLabel(locale, snapshot.status.input, input?.name ?? snapshot.status.input)}</Copy><Icon name="chevron" color={colors.muted} size={16}/>
      </Pressable>
      {track && <View style={[styles.row, { alignSelf: 'center', gap: 24, paddingVertical: 4 }]}>
        <IconButton name="previous" label={t('previousTrack')} disabled={disabled || !on} onPress={() => void execute({ type: 'playback', value: 'previous' })}/>
        <IconButton name={track.playback === 'play' ? 'pause' : 'play'} label={t(track.playback === 'play' ? 'pause' : 'play')} size={72} primary disabled={disabled || !on}
          onPress={() => void execute({ type: 'playback', value: track.playback === 'play' ? 'pause' : 'play' })}/>
        <IconButton name="next" label={t('nextTrack')} disabled={disabled || !on} onPress={() => void execute({ type: 'playback', value: 'next' })}/>
      </View>}
    </View>
    <Card>
      <View style={[styles.spread, { flexWrap: 'wrap' }]}>
        <IconButton name={snapshot.status.mute ? 'muted' : 'volume'} label={t(snapshot.status.mute ? 'unmute' : 'mute')} disabled={disabled || !on || !canMute} onPress={() => void execute({ type: 'mute', value: !snapshot.status.mute })}/>
        <View style={{ flex: 1, minWidth: 72 }}><Copy kind="title">{volume ?? '—'}{maxVolume !== undefined && <Copy kind="small"> {t('of')} {maxVolume}</Copy>}</Copy><Copy kind="label">{volumeLabel}</Copy></View>
        <IconButton name="minus" label={`${volumeLabel} −`} disabled={disabled || !on || !canVolume || volume! <= range!.min} onPress={() => void execute({ type: 'volume', value: 'down' })}/>
        <IconButton name="plus" label={`${volumeLabel} +`} disabled={disabled || !on || !canVolume || volume! >= maxVolume!} onPress={() => void execute({ type: 'volume', value: 'up' })}/>
      </View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={volumeLabel} accessibilityValue={{ min: range?.min, max: maxVolume, now: volume }} style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
        <View style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, height: '100%', backgroundColor: colors.accent }}/>
      </View>
      <Copy kind="small">{t(bluetoothOutput ? 'bluetoothVolumeHint' : real ? 'liveVolume' : 'demoVolume')}</Copy>
    </Card>
    <BluetoothOutput/>
    <Card><Copy kind="heading">{t(real ? 'liveCapabilities' : 'capabilities')}</Copy><Copy kind="small">{t(real ? 'liveCapabilitiesHint' : 'capabilitiesHint')}</Copy>
      <Copy>{snapshot.features.connectivity.map(label => connectivityLabel(locale, label)).join(' · ')}</Copy>
    </Card>
    <Sources visible={sourcesOpen} onClose={() => setSourcesOpen(false)}/>
  </Screen>;
}
