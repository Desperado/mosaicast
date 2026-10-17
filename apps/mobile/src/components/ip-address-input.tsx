import { useRef, useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, TextInput, View } from 'react-native';
import { privateIPv4 } from '@mosaicast/musiccast';
import { useApp } from '../state/app';
import { insertAddressDot, normalizeAddress } from '../state/address';
import { Button, styles } from './ui';

export function IPAddressInput({ value, onChange, onSubmit, busy, invalid }: {
  value: string; onChange: (value: string) => void; onSubmit: () => void; busy: boolean; invalid: boolean;
}) {
  const { colors, t } = useApp();
  const cursor = useRef({ start: value.length, end: value.length });
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
  function addDot() {
    const next = insertAddressDot(value, cursor.current);
    cursor.current = next.selection;
    onChange(next.address);
    setSelection(next.selection);
  }
  return <>
    <TextInput accessibilityLabel={t('ipAddress')} accessibilityHint={t('ipHint')} value={value} editable={!busy}
      placeholder="192.168.1.40" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
      autoCapitalize="none" autoCorrect={false} autoComplete="off" spellCheck={false} smartInsertDelete={false}
      selectTextOnFocus clearButtonMode="while-editing" returnKeyType="done" maxLength={64}
      inputAccessoryViewID={Platform.OS === 'ios' ? 'yamaha-ip-toolbar' : undefined}
      selection={selection} onSelectionChange={event => { const next = event.nativeEvent.selection; cursor.current = next; setSelection(current => current ? next : undefined); }}
      onSubmitEditing={onSubmit}
      onChangeText={text => { setSelection(undefined); onChange(normalizeAddress(text)); }}
      style={{ minHeight: 56, padding: 16, fontSize: 18, fontVariant: ['tabular-nums'], borderRadius: 12, borderWidth: 1,
        borderColor: invalid ? colors.accent : colors.border, color: colors.text, backgroundColor: colors.surface }}/>
    {Platform.OS === 'ios' && <InputAccessoryView nativeID="yamaha-ip-toolbar" backgroundColor={colors.surface}>
      <View style={[styles.row, { padding: 8, backgroundColor: colors.surface, flexWrap: 'wrap' }]}>
        <Button label="." accessibilityLabel={t('insertDot')} disabled={busy} onPress={addDot}/>
        <View style={{ flex: 1, minWidth: 140 }}><Button label={t(busy ? 'connecting' : 'connectByIP')} primary disabled={busy || !privateIPv4(value)} onPress={onSubmit}/></View>
        <Button label={t('close')} onPress={() => Keyboard.dismiss()}/>
      </View>
    </InputAccessoryView>}
  </>;
}
