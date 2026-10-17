import { View } from 'react-native';
import { useApp } from '../state/app';
import { bluetoothDeviceKey } from '../state/preferences';
import { Button, Card, Copy, styles } from './ui';

export function BluetoothOutput() {
  const { real, snapshot, busy, controlsDisabled, execute, preferences, deviceState, hideBluetoothDevice, storageError, t } = useApp();
  if (!real || !snapshot?.features.bluetoothOutput) return null;
  const bluetooth = snapshot.bluetooth;
  const disabled = busy || controlsDisabled || snapshot.status.power !== 'on' || !bluetooth;
  const inputConflict = snapshot.status.input === 'bluetooth';
  const host = deviceState.host ?? '';
  const devices = bluetooth?.devices.filter(device => device.address !== bluetooth.connected?.address && !preferences.hiddenBluetoothDevices.includes(bluetoothDeviceKey(host, device.address))) ?? [];
  const hasHidden = preferences.hiddenBluetoothDevices.some(key => key.startsWith(`${host}/`));
  return <Card>
    <Copy kind="heading">{t('bluetoothHeadphones')}</Copy>
    {!bluetooth ? <Copy kind="small">{t(snapshot.status.power === 'on' ? 'bluetoothUnavailable' : 'liveStandby')}</Copy> : <>
      <Copy>{t(bluetooth.enabled ? 'bluetoothOutputOn' : 'bluetoothOutputOff')}</Copy>
      <Button label={t(bluetooth.enabled ? 'bluetoothDisable' : 'bluetoothEnable')} disabled={disabled || (!bluetooth.enabled && inputConflict)}
        onPress={() => void execute({ type: 'bluetoothOutput', value: !bluetooth.enabled })}/>
      {inputConflict && <Copy kind="small">{t('bluetoothInputConflict')}</Copy>}
      {bluetooth.connected && <View style={styles.smallStack}>
        <Copy>{t('connected')}: {bluetooth.connected.name || t('bluetoothUnnamed')}</Copy>
        <Copy kind="small">{t('bluetoothVolumeHint')}</Copy>
        <Button label={t('bluetoothDisconnect')} disabled={disabled} onPress={() => void execute({ type: 'bluetoothDisconnect', value: 'disconnect' })}/>
      </View>}
      {bluetooth.enabled && <>
        <Copy kind="small">{t('bluetoothPairingHint')}</Copy>
        <Button label={t(bluetooth.updating ? 'bluetoothSearching' : 'bluetoothSearch')} disabled={disabled || inputConflict || bluetooth.updating}
          onPress={() => void execute({ type: 'bluetoothScan', value: 'start' })}/>
        {(bluetooth.updating || !!devices.length || !bluetooth.connected || hasHidden) && <Copy kind="small">{t(bluetooth.updating ? 'bluetoothSearching' : devices.length ? 'bluetoothResultsHint' : hasHidden ? 'bluetoothNoVisibleDevices' : 'bluetoothNoDevices')}</Copy>}
        {!!devices.length && <Copy kind="small">{t('bluetoothRemoveHint')}</Copy>}
        {devices.map(device => <View key={device.address} style={styles.smallStack}>
          <Copy>{device.name || t('bluetoothUnnamed')}</Copy>
          <Copy kind="small">{device.address.match(/.{2}/g)?.join(':')}</Copy>
          <Button label={t('bluetoothConnect')} disabled={disabled || inputConflict || bluetooth.updating}
            onPress={() => void execute({ type: 'bluetoothConnect', value: device.address })}/>
          <Button label={t('bluetoothRemove')} disabled={disabled || storageError === 'loadError'}
            onPress={() => void hideBluetoothDevice(device.address)}/>
        </View>)}
      </>}
      {hasHidden && <Button label={t('bluetoothRestore')} disabled={disabled || storageError === 'loadError'} onPress={() => void hideBluetoothDevice()}/>}
    </>}
  </Card>;
}
