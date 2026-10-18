import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { router, usePathname } from 'expo-router';
import { sourceLabel } from '@mosaicast/i18n';
import { canBrowseSource } from '@mosaicast/musiccast';
import { useApp } from '../../state/app';
import { Button, Card, Copy, DemoBadge, IconButton, ErrorNotice, Screen, styles } from '../../components/ui';
import { Icon } from '../../components/icon';
import { PlaybackPanel, RadioControls, RadioPresetsButton } from '../../components/playback';
import { Sources } from '../../components/sources';

export default function Listen() {
  const { colors, t, locale, snapshot, activeRoom, busy, pendingCommand, refreshing, commandError, execute, real, deviceState, refresh, controlsDisabled, hardwareVolumeUnavailable } = useApp();
  const { width, height } = useWindowDimensions();
  const focused = usePathname() === '/listen';
  const landscape = width > height;
  const [sourcesOpen, setSourcesOpen] = useState(false);
  if (!snapshot) return <Screen tab><Copy>{t(commandError ?? 'loading')}</Copy><Button label={t('connectByIP')} disabled={busy} onPress={() => router.push('/connection')}/><Button label={t('settings')} onPress={() => router.push('/settings')}/></Screen>;
  const on = snapshot.status.power === 'on';
  const track = snapshot.track;
  const range = snapshot.features.volumeRange;
  const volume = snapshot.status.volume;
  const disabled = controlsDisabled;
  const maxVolume = range ? Math.min(range.max, snapshot.status.maxVolume ?? range.max) : undefined;
  const canVolume = snapshot.features.controls.includes('volume') && range && volume !== undefined;
  const canMute = snapshot.features.controls.includes('mute') && typeof snapshot.status.mute === 'boolean';
  const ratio = range && maxVolume !== undefined && volume !== undefined && maxVolume > range.min ? (volume - range.min) / (maxVolume - range.min) : 0;
  const input = snapshot.features.sources.find(source => source.id === snapshot.status.input);
  // Headphone volume is set on the headphones; this control only changes Yamaha's speakers.
  const volumeLabel = t(real && snapshot.bluetooth?.enabled ? 'speakerVolume' : 'volume');
  return <Screen tab header={<View style={styles.spread}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('rooms')} onPress={() => router.navigate('/(tabs)/rooms')} style={{ flex: 1, minWidth: 0, minHeight: 48, justifyContent: 'center', gap: 2 }}>
      <View style={[styles.row, { gap: 4 }]}><Copy kind="heading" lines={1} style={{ flexShrink: 1 }}>{real ? snapshot.model : t(activeRoom === 'studio' ? 'studio' : 'livingRoom')}</Copy><Icon name="chevron" color={colors.muted} size={16}/></View>
      <Copy kind="small" lines={1}>{t(real && deviceState.phase !== 'connected' ? 'disconnected' : on ? real ? 'connected' : 'simulated' : 'standby')}</Copy>
    </Pressable>
    <View style={[styles.row, { gap: 4 }]}>
      {!real && <DemoBadge/>}
      {real && <IconButton size={44} name="refresh" label={t('refresh')} pending={busy} working={refreshing} onPress={() => void refresh()}/>}
      <IconButton size={44} name="power" label={t(on ? 'standby' : 'powerOn')} pending={busy} working={pendingCommand?.type === 'power'} disabled={disabled || !snapshot.features.controls.includes('power')} onPress={() => void execute({ type: 'power', value: on ? 'standby' : 'on' })}/>
      <IconButton size={44} name="settings" label={t('settings')} onPress={() => router.push('/settings')}/>
    </View>
  </View>}>
    <View style={{ flex: 1, minHeight: 0, flexDirection: landscape ? 'row' : 'column', gap: 8 }}>
      <View style={{ flex: 1, minWidth: 0, minHeight: 0, gap: 8 }}>
        <PlaybackPanel/>
        <View style={[styles.row, { gap: 8 }]}>
          <View style={{ flex: 1, minWidth: 0 }}><Button label={sourceLabel(locale, snapshot.status.input, input?.name ?? snapshot.status.input)} accessibilityLabel={t('sources')} icon="music" onPress={() => setSourcesOpen(true)}/></View>
          {input?.tuner && snapshot.features.tuner?.presets && <View style={{ flex: 1, minWidth: 0 }}><RadioPresetsButton/></View>}
          {input && canBrowseSource(input) && <View style={{ flex: 1, minWidth: 0 }}><Button label={t('browse')} accessibilityLabel={t('browseSource')} pending={busy} disabled={disabled || !on} onPress={() => router.push({ pathname: '/browse', params: { input: input.id } })}/></View>}
          {real && snapshot.features.bluetoothOutput && <View style={{ flex: 1, minWidth: 0 }}><Button label={t('headphones')} accessibilityLabel={t('bluetoothHeadphones')} onPress={() => router.push('/bluetooth')}/></View>}
        </View>
      </View>
      <View style={{ flex: landscape ? 1 : undefined, minWidth: 0, justifyContent: 'center', gap: 8 }}>
        {on && input?.tuner && snapshot.features.tuner && <RadioControls/>}
        {on && track ? <View style={[styles.row, { alignSelf: 'center', gap: 24, paddingVertical: 4 }]}>
          <IconButton name="previous" label={t('previousTrack')} pending={busy} working={pendingCommand?.type === 'playback' && pendingCommand.value === 'previous'} disabled={disabled} onPress={() => void execute({ type: 'playback', value: 'previous' })}/>
          <IconButton name={track.playback === 'play' ? 'pause' : 'play'} label={t(track.playback === 'play' ? 'pause' : 'play')} size={height < 740 ? 56 : 72} primary pending={busy} working={pendingCommand?.type === 'playback' && ['play', 'pause'].includes(pendingCommand.value)} disabled={disabled}
            onPress={() => void execute({ type: 'playback', value: track.playback === 'play' ? 'pause' : 'play' })}/>
          <IconButton name="next" label={t('nextTrack')} pending={busy} working={pendingCommand?.type === 'playback' && pendingCommand.value === 'next'} disabled={disabled} onPress={() => void execute({ type: 'playback', value: 'next' })}/>
        </View> : !on && <Button label={t('powerOn')} primary pending={busy} working={pendingCommand?.type === 'power'} disabled={disabled || !snapshot.features.controls.includes('power')} onPress={() => void execute({ type: 'power', value: 'on' })}/>}
        <Card>
          <View style={[styles.row, { gap: 8 }]}>
            <IconButton size={44} name={snapshot.status.mute ? 'muted' : 'volume'} label={t(snapshot.status.mute ? 'unmute' : 'mute')} pending={busy} working={pendingCommand?.type === 'mute'} disabled={disabled || !on || !canMute} onPress={() => void execute({ type: 'mute', value: !snapshot.status.mute })}/>
            <View style={{ flex: 1, minWidth: 0 }}><Copy kind="heading" lines={1}>{volume ?? '—'}{maxVolume !== undefined && <Copy kind="small"> / {maxVolume}</Copy>}</Copy><Copy kind="label" lines={1}>{volumeLabel}</Copy></View>
            <IconButton size={44} name="minus" label={`${volumeLabel} −`} pending={busy} working={pendingCommand?.type === 'volume' && pendingCommand.value === 'down'} disabled={disabled || !on || !canVolume || volume! <= range!.min} onPress={() => void execute({ type: 'volume', value: 'down' })}/>
            <IconButton size={44} name="plus" label={`${volumeLabel} +`} pending={busy} working={pendingCommand?.type === 'volume' && pendingCommand.value === 'up'} disabled={disabled || !on || !canVolume || volume! >= maxVolume!} onPress={() => void execute({ type: 'volume', value: 'up' })}/>
          </View>
          <View accessible accessibilityRole="progressbar" accessibilityLabel={volumeLabel} accessibilityValue={{ min: range?.min, max: maxVolume, now: volume }} style={{ height: 4, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, height: '100%', backgroundColor: colors.accent }}/>
          </View>
        </Card>
      </View>
    </View>
    <Sources visible={sourcesOpen} onClose={() => setSourcesOpen(false)}/>
    {real && hardwareVolumeUnavailable && <Copy kind="small">{t('volumeButtonsUnavailable')}</Copy>}
    {focused && commandError && <ErrorNotice key={commandError} message={t(commandError)}>
      <Button label={t('refresh')} disabled={busy} onPress={() => void refresh()}/>
    </ErrorNotice>}
  </Screen>;
}
