import { Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { sourceLabel } from '@mosaicast/i18n';
import { demoRooms, useApp } from '../../state/app';
import { Button, Card, Copy, DemoBadge, IconButton, Screen, styles } from '../../components/ui';
import { Icon } from '../../components/icon';

export default function Rooms() {
  const { colors, t, locale, activeRoom, setActiveRoom, snapshots, snapshot, real, deviceState } = useApp();
  const { width, height } = useWindowDimensions();
  function open(room: typeof activeRoom) { setActiveRoom(room); router.navigate('/(tabs)/listen'); }
  return <Screen tab header={<View style={styles.spread}><Copy kind="heading">{t('roomsTitle')}</Copy><View style={styles.row}>{!real && <DemoBadge/>}<IconButton name="settings" label={t('settings')} onPress={() => router.push('/settings')}/></View></View>}
    footer={snapshot?.track && <Pressable accessibilityRole="button" accessibilityLabel={`${t('nowPlaying')}: ${snapshot.track.title}`} onPress={() => open(activeRoom)}>
      <Card style={{ backgroundColor: colors.tint }}><View style={styles.row}><Icon name="listen" color={colors.accent}/><View style={{ flex: 1, minWidth: 0 }}><Copy kind="small" lines={1}>{real ? snapshot.model : t(activeRoom === 'studio' ? 'studio' : 'livingRoom')}</Copy><Copy lines={1}>{snapshot.track.title}</Copy></View><Icon name="chevron" color={colors.accent}/></View></Card>
    </Pressable>}>
    {real ? <Card>
      <Button label={deviceState.snapshot?.model ?? 'Yamaha'} onPress={() => open('device')}/>
      <Copy kind="small">{t(deviceState.phase === 'connecting' ? 'connecting' : deviceState.phase === 'connected' ? 'connected' : 'disconnected')}</Copy>
    </Card> : <View style={{ flexDirection: width > height ? 'row' : 'column', gap: 8 }}>
    {demoRooms.map(room => {
      const state = snapshots[room];
      const source = state?.features.sources.find(value => value.id === state.status.input);
      return <Pressable key={room} style={width > height ? { flex: 1 } : undefined} accessibilityRole="button" accessibilityLabel={`${t('openRoom')}: ${t(room)}`} accessibilityState={{ selected: room === activeRoom }} onPress={() => open(room)}>
        <Card style={{ borderColor: room === activeRoom ? colors.accent : colors.border }}>
          <View style={styles.spread}><Copy kind="heading" lines={1} style={{ flex: 1 }}>{t(room)}</Copy><Icon name="chevron" color={colors.muted}/></View>
          <Copy lines={1}>{state?.track?.title ?? t('noTrack')}</Copy>
          <Copy kind="small" lines={1}>{source ? sourceLabel(locale, source.id, source.name) : t('loading')} · {t('volume')} {state?.status.volume ?? '—'}</Copy>
        </Card>
      </Pressable>;
    })}</View>}
    <Button label={t('addDevice')} icon="plus" onPress={() => router.push('/connection')}/>
  </Screen>;
}
