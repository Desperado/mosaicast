import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sourceLabel } from '@mosaicast/i18n';
import { useApp } from '../state/app';
import { Copy, DemoBadge, IconButton, styles } from './ui';
import { Icon } from './icon';

export function Sources({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, t, locale, snapshot, busy, pendingCommand, execute, real, controlsDisabled } = useApp();
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000088' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ flex: 1 }}/>
      <SafeAreaView edges={['bottom', 'left', 'right']} accessibilityViewIsModal style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', width: '100%', maxWidth: 600, alignSelf: 'center' }}>
        <View style={[styles.spread, { padding: 12 }]}><Copy kind="heading" style={{ flex: 1 }}>{t('chooseSource')}</Copy>{!real && <DemoBadge/>}<IconButton name="close" label={t('close')} onPress={onClose}/></View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>
          {snapshot?.features.sources.map(source => {
            const selected = source.id === snapshot.status.input;
            return <Pressable key={source.id} aria-busy={pendingCommand?.type === 'input' && pendingCommand.value === source.id} accessibilityRole="button" accessibilityLabel={sourceLabel(locale, source.id, source.name)} accessibilityState={{ selected, busy: pendingCommand?.type === 'input' && pendingCommand.value === source.id, disabled: busy || controlsDisabled || snapshot.status.power !== 'on' }}
              disabled={busy || controlsDisabled || snapshot.status.power !== 'on'} onPress={() => { void execute({ type: 'input', value: source.id }).then(onClose); }}
              style={({ pressed }) => ({ padding: 12, minHeight: 48, borderRadius: 12, backgroundColor: selected ? colors.tint : colors.raised, opacity: pressed || controlsDisabled || snapshot.status.power !== 'on' ? 0.5 : 1, flexDirection: 'row', alignItems: 'center', gap: 14 })}>
              {pendingCommand?.type === 'input' && pendingCommand.value === source.id && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, borderWidth: 2, borderRadius: 12, borderColor: colors.accent }}/>}
              <Icon name="music" color={selected ? colors.accent : colors.muted}/>
              <View style={{ flex: 1, minWidth: 0 }}><Copy>{sourceLabel(locale, source.id, source.name)}</Copy></View>
              {selected && <Icon name="check" color={colors.accent}/>}
            </Pressable>;
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}
