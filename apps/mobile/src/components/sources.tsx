import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sourceLabel } from '@mosaicast/i18n';
import { useApp } from '../state/app';
import { Copy, DemoBadge, IconButton, styles } from './ui';
import { Icon } from './icon';

export function Sources({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, t, locale, snapshot, busy, execute } = useApp();
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ flex: 1 }}/>
      <SafeAreaView edges={['bottom', 'left', 'right']} accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', width: '100%', maxWidth: 600, alignSelf: 'center' }}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
          <View style={styles.spread}><Copy kind="heading">{t('chooseSource')}</Copy><IconButton name="close" label={t('close')} onPress={onClose}/></View>
          <View style={styles.row}><DemoBadge/><Copy kind="small" style={{ flex: 1 }}>{t('sourceHint')}</Copy></View>
          {snapshot?.features.sources.map(source => {
            const selected = source.id === snapshot.status.input;
            return <Pressable key={source.id} accessibilityRole="button" accessibilityLabel={sourceLabel(locale, source.id, source.name)} accessibilityState={{ selected, disabled: busy || snapshot.status.power !== 'on' }}
              disabled={busy || snapshot.status.power !== 'on'} onPress={() => { void execute({ type: 'input', value: source.id }); onClose(); }}
              style={({ pressed }) => ({ padding: 16, borderRadius: 12, backgroundColor: selected ? colors.tint : colors.raised, opacity: pressed || busy || snapshot.status.power !== 'on' ? 0.5 : 1, flexDirection: 'row', alignItems: 'center', gap: 14 })}>
              <Icon name="music" color={selected ? colors.accent : colors.muted}/>
              <View style={{ flex: 1, gap: 3 }}><Copy>{sourceLabel(locale, source.id, source.name)}</Copy><Copy kind="small">{t(source.networkPlayer ? 'networkPlayback' : 'inputOnly')}</Copy></View>
              {selected && <Icon name="check" color={colors.accent}/>}
            </Pressable>;
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}
