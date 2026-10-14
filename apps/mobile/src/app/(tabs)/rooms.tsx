import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { sourceLabel } from '@mosaicast/i18n';
import { demoRooms, useApp } from '../../state/app';
import { Button, Card, Copy, DemoBadge, IconButton, Mosaic, Screen, styles } from '../../components/ui';
import { Icon } from '../../components/icon';

export default function Rooms() {
  const { colors, t, locale, activeRoom, setActiveRoom, snapshots, snapshot, real, deviceState } = useApp();
  function open(room: typeof activeRoom) { setActiveRoom(room); router.navigate('/(tabs)/listen'); }
  return <Screen>
    <View style={styles.spread}><Copy kind="label">Mosaicast</Copy><IconButton name="settings" label={t('settings')} onPress={() => router.push('/settings')}/></View>
    <View style={styles.smallStack}><Copy kind="title">{t('roomsTitle')}</Copy><Copy color={colors.muted}>{t('roomsBody')}</Copy></View>
    {real ? <>
      <Copy kind="small">{t('deviceNotice')}</Copy>
      <Button label={`${deviceState.snapshot?.model ?? 'Yamaha'} · ${deviceState.host ?? t('unavailable')}`} onPress={() => open('device')}/>
      <Copy>{t(deviceState.phase === 'connecting' ? 'connecting' : deviceState.phase === 'connected' ? 'connected' : 'disconnected')}</Copy>
    </> : <><View style={styles.row}><DemoBadge/><Copy kind="small" style={{ flex: 1 }}>{t('demoNotice')}</Copy></View>
    {demoRooms.map((room, i) => {
      const state = snapshots[room];
      const source = state?.features.sources.find(value => value.id === state.status.input);
      return <Pressable key={room} accessibilityRole="button" accessibilityLabel={`${t('openRoom')}: ${t(room)}`} accessibilityState={{ selected: room === activeRoom }} onPress={() => open(room)}>
        <Card style={{ borderColor: room === activeRoom ? colors.accent : colors.border }}>
          <View style={styles.row}><Mosaic compact variant={i}/><View style={{ flex: 1, gap: 4 }}><Copy kind="heading">{t(room)}</Copy><Copy kind="small">{t('exampleDevice')} · {t(state?.status.power === 'standby' ? 'standby' : 'simulated')}</Copy></View><Icon name="chevron" color={colors.muted}/></View>
          <Copy>{state?.track?.title ?? t('noTrack')}</Copy>
          <View style={[styles.spread, { flexWrap: 'wrap' }]}><Copy kind="small">{source ? sourceLabel(locale, source.id, source.name) : t('loading')} · {t('volume')} {state?.status.volume ?? '—'}</Copy>{room === activeRoom && <Copy kind="small" color={colors.accent}>{t('activeRoom')}</Copy>}</View>
        </Card>
      </Pressable>;
    })}</>}
    <Button label={t('addDevice')} icon="plus" onPress={() => router.push('/connection')}/>
    <View style={{ flex: 1 }}/>
    {snapshot?.track && <Pressable accessibilityRole="button" accessibilityLabel={`${t('nowPlaying')}: ${snapshot.track.title}`} onPress={() => open(activeRoom)}>
      <Card style={{ backgroundColor: colors.tint }}><View style={styles.row}><Icon name="listen" color={colors.accent}/><View style={{ flex: 1, gap: 2 }}><Copy kind="small">{real ? snapshot.model : t(activeRoom === 'studio' ? 'studio' : 'livingRoom')} · {t(real ? deviceState.phase === 'connected' ? 'connected' : 'disconnected' : 'demo')}</Copy><Copy>{snapshot.track.title}</Copy></View><Icon name="chevron" color={colors.accent}/></View></Card>
    </Pressable>}
  </Screen>;
}
