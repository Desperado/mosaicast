import { useState } from 'react';
import { Image, View, useWindowDimensions } from 'react-native';
import { radius } from '@mosaicast/design';
import { sourceLabel } from '@mosaicast/i18n';
import { useApp } from '../state/app';
import { Button, Copy, IconButton, InfoDialog, Mosaic, styles } from './ui';
import { Icon } from './icon';

const frequency = (value?: number) => value === undefined ? 'FM' : `${Number((value / 1000).toFixed(2))} MHz`;

export function PlaybackPanel() {
  const { snapshot, colors, t, real, locale, activeRoom } = useApp();
  const { width, height, fontScale } = useWindowDimensions();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [failedArtwork, setFailedArtwork] = useState<string>();
  if (!snapshot) return null;
  const { track, tuner, status } = snapshot;
  const on = status.power === 'on';
  const input = snapshot.features.sources.find(source => source.id === status.input);
  const radio = on && input?.tuner;
  const largeText = fontScale > 1.35;
  const compact = !largeText && (height < 700 || width > height || size.height < 240);
  const artSize = compact ? Math.min(128, Math.max(64, size.width * 0.4), Math.max(64, size.height)) : largeText ? 220 : Math.max(64, Math.min(440, size.width, size.height - 140));
  const title = !on ? t('standby') : radio ? tuner?.station || (tuner?.band === 'fm' ? frequency(tuner.frequency) : tuner?.band.toUpperCase() || t('radio')) : track?.title || sourceLabel(locale, status.input, input?.name ?? status.input);
  const subtitle = !on ? t(real ? 'liveStandby' : 'standbyBody') : radio ? tuner ? tuner.scanning ? t('scanningStations') : tuner.text || (tuner.ready ? tuner.band.toUpperCase() : t('radioNotReady')) : t('radioUnavailable') : track ? [track.artist, track.album].filter(Boolean).join(' · ') : t(real ? 'liveNoTrack' : 'noTrackBody');
  return <View testID="playback-panel" onLayout={event => setSize(event.nativeEvent.layout)} style={{ flex: 1, minHeight: largeText ? 380 : 88, minWidth: 0, justifyContent: 'center', gap: compact ? 12 : 16, alignItems: compact ? 'center' : 'stretch', flexDirection: compact ? 'row' : 'column' }}>
    <View style={{ width: artSize, height: artSize, alignSelf: 'center', borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center', borderWidth: track?.artwork ? 0 : 1, borderColor: colors.border }}>
      {on && track?.artwork && failedArtwork !== track.artwork ? <Image source={{ uri: track.artwork }} accessibilityLabel={track.album || track.title} resizeMode="cover" onError={() => setFailedArtwork(track.artwork)} style={{ width: '100%', height: '100%' }}/>
        : on && track && !real ? <Mosaic fill variant={activeRoom === 'studio' ? 1 : 0}/>
        : radio && tuner?.band === 'fm' ? <Copy kind="title" lines={1} style={{ fontSize: Math.min(compact ? 22 : 48, artSize * 0.16), lineHeight: compact ? 30 : 58, letterSpacing: -1, textAlign: 'center' }}>{frequency(tuner.frequency)}</Copy>
        : <Icon name={!on ? 'power' : radio ? 'radio' : 'music'} size={artSize * 0.4} color={colors.accent}/>}
    </View>
    <View style={{ flex: compact ? 1 : undefined, minWidth: 0, gap: 4 }}>
      <Copy kind="label" lines={1}>{radio ? t('radio') : t('nowPlaying')}{on && track ? ` · ${t(track.playback === 'play' ? 'playing' : track.playback === 'pause' ? 'paused' : 'stopped')}` : ''}</Copy>
      <Copy kind={compact ? 'heading' : 'title'} lines={2}>{title}</Copy>
      <Copy kind="small" lines={2}>{subtitle}</Copy>
      {on && track && track.duration !== undefined && track.duration > 0 && track.elapsed !== undefined && <View style={{ height: 3, marginTop: 8, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityLabel={t('nowPlaying')} accessibilityValue={{ min: 0, max: track.duration, now: track.elapsed }}>
        <View style={{ height: '100%', width: `${Math.max(0, Math.min(1, track.elapsed / track.duration)) * 100}%`, backgroundColor: colors.accent }}/>
      </View>}
    </View>
  </View>;
}

export function RadioControls() {
  const { snapshot, t, busy, pendingCommand, controlsDisabled, execute } = useApp();
  if (!snapshot?.features.tuner) return null;
  const { tuner } = snapshot;
  const features = snapshot.features.tuner;
  const disabled = controlsDisabled || snapshot.status.power !== 'on';
  const fm = tuner?.band === 'fm';
  const canTune = !!tuner && (fm ? !!features.fmRange && tuner.frequency !== undefined : tuner.ready);
  return <View style={{ gap: 8 }}>
    <View style={[styles.row, { gap: 8 }]}>
      {features.bands.map(band => <View key={band} style={{ flex: 1 }}><Button label={band.toUpperCase()} selected={tuner?.band === band} pending={busy} working={pendingCommand?.type === 'tunerBand' && pendingCommand.value === band} disabled={disabled} onPress={() => void execute({ type: 'tunerBand', value: band })}/></View>)}
    </View>
    {tuner?.band === 'dab' && !tuner.ready && features.initialScan ? <Button label={t(tuner.scanning ? 'cancelScan' : 'scanStations')} pending={busy} working={pendingCommand?.type === 'tunerScan'} disabled={disabled} onPress={() => void execute({ type: 'tunerScan', value: tuner.scanning ? 'cancel' : 'start' })}/> : tuner && <View style={[styles.row, { gap: 8 }]}>
      <IconButton name="previous" label={t(fm ? 'seekDown' : 'previousStation')} pending={busy} working={pendingCommand?.type === (fm ? 'tunerTune' : 'tunerService') && pendingCommand.value === (fm ? 'auto_down' : 'previous')} disabled={disabled || !canTune} onPress={() => void execute(fm ? { type: 'tunerTune', value: 'auto_down' } : { type: 'tunerService', value: 'previous' })}/>
      {fm && <IconButton name="minus" label={t('tuneDown')} pending={busy} working={pendingCommand?.type === 'tunerTune' && pendingCommand.value === 'down'} disabled={disabled || !canTune} onPress={() => void execute({ type: 'tunerTune', value: 'down' })}/>}
      <Copy kind="small" lines={1} style={{ flex: 1, textAlign: 'center' }}>{fm ? frequency(tuner.frequency) : 'DAB'}</Copy>
      {fm && <IconButton name="plus" label={t('tuneUp')} pending={busy} working={pendingCommand?.type === 'tunerTune' && pendingCommand.value === 'up'} disabled={disabled || !canTune} onPress={() => void execute({ type: 'tunerTune', value: 'up' })}/>}
      <IconButton name="next" label={t(fm ? 'seekUp' : 'nextStation')} pending={busy} working={pendingCommand?.type === (fm ? 'tunerTune' : 'tunerService') && pendingCommand.value === (fm ? 'auto_up' : 'next')} disabled={disabled || !canTune} onPress={() => void execute(fm ? { type: 'tunerTune', value: 'auto_up' } : { type: 'tunerService', value: 'next' })}/>
    </View>}
  </View>;
}

export function RadioPresetsButton() {
  const { snapshot, t, busy, pendingCommand, controlsDisabled, execute } = useApp();
  const [presetsOpen, setPresetsOpen] = useState(false);
  if (!snapshot?.features.tuner?.presets) return null;
  const { tuner } = snapshot;
  const disabled = controlsDisabled || snapshot.status.power !== 'on';
  return <>
    <Button label={t('presets')} onPress={() => setPresetsOpen(true)}/>
    <InfoDialog visible={presetsOpen} title={t('presets')} onClose={() => setPresetsOpen(false)}>
      {tuner?.presets?.length ? tuner.presets.map(preset => <Button key={preset.slot} label={`${t('preset')} ${preset.slot} · ${preset.band === 'fm' ? frequency(preset.number) : 'DAB'}`} selected={tuner.preset === preset.slot && tuner.band === preset.band} pending={busy} working={pendingCommand?.type === 'tunerPreset' && pendingCommand.value === preset.slot} disabled={disabled} onPress={() => { void execute({ type: 'tunerPreset', value: preset.slot }).then(() => setPresetsOpen(false)); }}/>) : <Copy>{t(tuner?.presets ? 'noPresets' : 'radioUnavailable')}</Copy>}
    </InfoDialog>
  </>;
}
