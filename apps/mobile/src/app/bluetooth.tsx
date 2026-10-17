import { usePathname } from 'expo-router';
import { BluetoothOutput } from '../components/bluetooth-output';
import { BackHeader, Button, ErrorNotice, Screen, ScrollArea } from '../components/ui';
import { useApp } from '../state/app';

// The Listen tab does not scroll, so headphone controls get their own screen.
export default function Bluetooth() {
  const focused = usePathname() === '/bluetooth';
  const { t, busy, commandError, refresh } = useApp();
  return <Screen><BackHeader title={t('bluetoothHeadphones')}/>
    <ScrollArea><BluetoothOutput/></ScrollArea>
    {focused && commandError && <ErrorNotice key={commandError} message={t(commandError)}>
      <Button label={t('refresh')} disabled={busy} onPress={() => void refresh()}/>
    </ErrorNotice>}
  </Screen>;
}
