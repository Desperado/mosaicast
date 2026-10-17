import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocales } from 'expo-localization';
import { themes } from '@mosaicast/design';
import { translate, type TranslationKey } from '@mosaicast/i18n';
import { BrowseError, demoController, DeviceSession, type BrowseAction, type DeviceState, type Command, type Snapshot } from '@mosaicast/musiccast';
import { PhoneCompanion, type PeerStatus } from './phone-companion';
import { deviceController } from './device-controller';
import { useHardwareVolume } from './hardware-volume';
import { lifecycleChange } from './lifecycle';
import { defaults, parsePreferences, preferenceWriter, preferencesKey, resolveAppearance, resolveLanguage, updateHiddenBluetoothDevices, type Preferences } from './preferences';

export const demoRooms = ['livingRoom', 'studio'] as const;
type DemoRoom = typeof demoRooms[number];
type Room = DemoRoom | 'device';

function useAppState() {
  const systemTheme = useColorScheme();
  const locales = useLocales();
  const [preferences, setPreferences] = useState<Preferences>({ ...defaults });
  const preferencesRef = useRef(preferences);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<'loadError' | 'saveError'>();
  const loadRequest = useRef(0);
  const mounted = useRef(false);
  const [activeRoom, setActiveRoom] = useState<Room>('livingRoom');
  const [controllers] = useState(() => ({ livingRoom: demoController(), studio: demoController() }));
  const [snapshots, setSnapshots] = useState<Partial<Record<DemoRoom, Snapshot>>>({});
  const [demoBrowse, setDemoBrowse] = useState<Partial<Record<DemoRoom, Pick<DeviceState, 'browse' | 'browseError' | 'browseAccepted'>>>>({});
  const [deviceState, setDeviceState] = useState<DeviceState>({ phase: 'disconnected', busy: false, needsRefresh: false });
  const companionMode = useRef(false);
  const phoneCompanion = useRef<PhoneCompanion | undefined>(undefined);
  const [peerStatus, setPeerStatus] = useState<PeerStatus>({});
  const [session] = useState(() => new DeviceSession(host => {
    if (!companionMode.current) return deviceController(host);
    const controller = new PhoneCompanion(host, setPeerStatus);
    phoneCompanion.current = controller;
    return controller;
  }, setDeviceState));
  const [busy, setBusy] = useState<Partial<Record<Room, boolean>>>({});
  const [pendingCommands, setPendingCommands] = useState<Partial<Record<DemoRoom, Command>>>({});
  const commandLocks = useRef(new Set<Room>());
  const [commandError, setCommandError] = useState<Room>();
  const [writer] = useState(() => preferenceWriter(value => AsyncStorage.setItem(preferencesKey, value)));
  const latestSave = useRef(0);

  const readPreferences = useCallback(() => AsyncStorage.getItem(preferencesKey).then(parsePreferences), []);
  const retryLoadPreferences = useCallback(() => {
    setReady(false);
    const request = ++loadRequest.current;
    return readPreferences().then(value => {
      if (mounted.current && request === loadRequest.current) {
        preferencesRef.current = value;
        setPreferences(value);
        setStorageError(undefined);
      }
      return true;
    }).catch(() => {
      if (mounted.current && request === loadRequest.current) setStorageError('loadError');
      return false;
    }).finally(() => {
      if (mounted.current && request === loadRequest.current) setReady(true);
    });
  }, [readPreferences]);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    const request = ++loadRequest.current;
    readPreferences().then(value => {
      if (active && request === loadRequest.current) {
        preferencesRef.current = value;
        setPreferences(value);
        setStorageError(undefined);
      }
    }).catch(() => {
      if (active && request === loadRequest.current) setStorageError('loadError');
    }).finally(() => {
      if (active && request === loadRequest.current) setReady(true);
    });
    Promise.all(demoRooms.map(async room => [room, await controllers[room].read()] as const))
      .then(entries => { if (active) setSnapshots(Object.fromEntries(entries)); })
      .catch(() => { if (active) setCommandError('livingRoom'); });
    return () => { active = false; mounted.current = false; };
  }, [controllers, readPreferences]);

  useEffect(() => {
    if (!ready) return;
    const restored = preferencesRef.current;
    if (restored.mode === 'device') {
      setActiveRoom('device');
      companionMode.current = restored.connection === 'companion';
      if (restored.address) void session.connect(restored.address);
    }
  }, [ready, session]);

  // Lifecycle applies in every room: a background companion must stop with its native listener.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const { active } = lifecycleChange(state);
      if (active !== undefined) session.setActive(active);
    });
    return () => { subscription.remove(); session.disconnect(); };
  }, [session]);

  useEffect(() => {
    if (activeRoom !== 'device') return;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    // A phone companion receives coordinator updates; only direct connections poll Yamaha.
    const poll = () => {
      if (!companionMode.current && foreground && (Platform.OS !== 'web' || !document.hidden)) void session.poll();
    };
    const subscription = AppState.addEventListener('change', state => {
      foreground = lifecycleChange(state).foreground;
      if (foreground) poll();
    });
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', poll);
    const timer = setInterval(poll, 1000);
    return () => {
      clearInterval(timer);
      subscription.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', poll);
    };
  }, [activeRoom, session]);

  async function savePreferences(patch: Partial<Omit<Preferences, 'version'>>): Promise<boolean> {
    if (!ready || storageError === 'loadError') return false;
    const next = { ...preferencesRef.current, ...patch };
    preferencesRef.current = next;
    setPreferences(next);
    const request = ++latestSave.current;
    try {
      await writer(next);
      if (request === latestSave.current) setStorageError(undefined);
      return true;
    } catch {
      if (request === latestSave.current) setStorageError('saveError');
      return false;
    }
  }

  async function resetPreferences(): Promise<boolean> {
    if (!ready || storageError !== 'loadError') return false;
    const next = { ...defaults };
    preferencesRef.current = next;
    setPreferences(next);
    const request = ++latestSave.current;
    try {
      await writer(next);
      if (request === latestSave.current) setStorageError(undefined);
      return true;
    } catch {
      if (request === latestSave.current) setStorageError('saveError');
      return false;
    }
  }

  async function execute(command: Command) {
    if (activeRoom === 'device') { await session.execute(command); return; }
    const room = activeRoom;
    if (commandLocks.current.has(room)) return;
    commandLocks.current.add(room);
    setPendingCommands(value => ({ ...value, [room]: command }));
    setBusy(value => ({ ...value, [room]: true }));
    setCommandError(undefined);
    try {
      const snapshot = await controllers[room].execute(command);
      setSnapshots(value => ({ ...value, [room]: snapshot }));
    } catch { setCommandError(room); }
    finally { commandLocks.current.delete(room); setBusy(value => ({ ...value, [room]: false })); setPendingCommands(value => ({ ...value, [room]: undefined })); }
  }

  async function connect(host: string) {
    companionMode.current = false;
    const success = await session.connect(host);
    if (success) {
      setActiveRoom('device');
      await savePreferences({ address: host, mode: 'device', demoStarted: true, connection: 'direct' });
    }
    return success && session.state.host === host && session.state.phase === 'connected' && preferencesRef.current.mode === 'device';
  }

  async function connectCompanion(host: string) {
    companionMode.current = true;
    const success = await session.connect(host);
    if (success) {
      setActiveRoom('device');
      await savePreferences({ address: host, mode: 'device', demoStarted: true, connection: 'companion' });
    }
    return success && session.state.host === host && session.state.phase === 'connected' && preferencesRef.current.mode === 'device';
  }

  const loadBrowse = useCallback(async (input: string, index = 0, takeover = false) => {
    if (activeRoom === 'device') { await session.loadBrowse(input, index, takeover); return; }
    const room = activeRoom;
    if (commandLocks.current.has(room)) return;
    commandLocks.current.add(room);
    setBusy(value => ({ ...value, [room]: true }));
    setDemoBrowse(value => ({ ...value, [room]: { browse: value[room]?.browse } }));
    try {
      const browse = await controllers[room].browse(input, index);
      setDemoBrowse(value => ({ ...value, [room]: { browse } }));
    } catch (error) {
      setDemoBrowse(value => ({ ...value, [room]: { browseError: error instanceof BrowseError ? error.code : 'browseReadError' } }));
    } finally { commandLocks.current.delete(room); setBusy(value => ({ ...value, [room]: false })); }
  }, [activeRoom, controllers, session]);

  async function browseAction(action: BrowseAction) {
    if (activeRoom === 'device') { await session.browseAction(action); return; }
    const room = activeRoom;
    if (commandLocks.current.has(room)) return;
    commandLocks.current.add(room);
    setBusy(value => ({ ...value, [room]: true }));
    try {
      const result = await controllers[room].browseAction(action);
      setDemoBrowse(value => ({ ...value, [room]: { browse: result.page, browseAccepted: action.type === 'play' } }));
      if (result.snapshot) setSnapshots(value => ({ ...value, [room]: result.snapshot }));
    } catch (error) {
      setDemoBrowse(value => ({ ...value, [room]: { browseError: error instanceof BrowseError ? error.code : 'browseReadError' } }));
    } finally { commandLocks.current.delete(room); setBusy(value => ({ ...value, [room]: false })); }
  }

  function startDemo() {
    session.disconnect();
    setActiveRoom('livingRoom');
    void savePreferences({ mode: 'demo', demoStarted: true });
  }

  function hideBluetoothDevice(address?: string) {
    const host = session.state.host;
    if (!host || session.state.phase !== 'connected' || session.state.busy) return;
    // Disconnect first. Hiding must never conceal an active audio connection.
    if (address && (!/^[\da-f]{12}$/i.test(address) || session.state.snapshot?.bluetooth?.connected?.address === address.toUpperCase())) return;
    return savePreferences({ hiddenBluetoothDevices: updateHiddenBluetoothDevices(preferencesRef.current.hiddenBluetoothDevices, host, address) });
  }

  const locale = resolveLanguage(preferences.language, locales[0]?.languageCode);
  const theme = resolveAppearance(preferences.appearance, systemTheme);
  const real = activeRoom === 'device';
  const hardwareVolumeUnavailable = useHardwareVolume(real && deviceState.phase === 'connected' && !deviceState.needsRefresh &&
    deviceState.snapshot?.status.power === 'on' && typeof deviceState.snapshot.status.volume === 'number' && !!deviceState.snapshot?.features.volumeRange &&
    deviceState.snapshot.features.controls.includes('volume'), session);
  return { ready, preferences, savePreferences, retryLoadPreferences, resetPreferences, storageError, activeRoom, setActiveRoom, snapshots,
    snapshot: real ? deviceState.snapshot : snapshots[activeRoom], busy: real ? deviceState.busy : busy[activeRoom] ?? false,
    pendingCommand: real ? deviceState.pendingCommand : pendingCommands[activeRoom],
    refreshing: real && !!deviceState.refreshing,
    commandError: real ? deviceState.error : commandError === activeRoom ? 'error' as const : undefined,
    deviceState, real, connect, connectCompanion, peerStatus, approvePeer: () => phoneCompanion.current?.approve(), cancelPeer: () => phoneCompanion.current?.cancelPairing(), takePeerControl: () => phoneCompanion.current?.takeControl(), startDemo, hideBluetoothDevice, hardwareVolumeUnavailable, refresh: () => session.refresh(),
    browseState: real ? deviceState : demoBrowse[activeRoom] ?? {}, loadBrowse, browseAction,
    controlsDisabled: real && (deviceState.phase !== 'connected' || deviceState.needsRefresh),
    execute, locale, theme, colors: themes[theme], t: (key: TranslationKey) => translate(locale, key) };
}

const AppContext = createContext<ReturnType<typeof useAppState> | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  return <AppContext.Provider value={useAppState()}>{children}</AppContext.Provider>;
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider is required');
  return value;
}
