import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocales } from 'expo-localization';
import { themes } from '@mosaicast/design';
import { translate, type TranslationKey } from '@mosaicast/i18n';
import { demoController, DeviceSession, type DeviceState, type Command, type Snapshot } from '@mosaicast/musiccast';
import { deviceController } from './device-controller';
import { defaults, parsePreferences, preferenceWriter, preferencesKey, resolveAppearance, resolveLanguage, type Preferences } from './preferences';

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
  const [deviceState, setDeviceState] = useState<DeviceState>({ phase: 'disconnected', busy: false, needsRefresh: false });
  const [session] = useState(() => new DeviceSession(deviceController, setDeviceState));
  const [busy, setBusy] = useState<Partial<Record<Room, boolean>>>({});
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
      if (restored.address) void session.connect(restored.address);
    }
  }, [ready, session]);

  useEffect(() => {
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const subscription = AppState.addEventListener('change', state => {
      foreground = state === 'active';
      if (foreground) void session.refresh(false);
    });
    const timer = setInterval(() => {
      if (foreground && (Platform.OS !== 'web' || !document.hidden)) void session.refresh(false);
    }, 8000);
    return () => { clearInterval(timer); subscription.remove(); session.disconnect(); };
  }, [session]);

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
    setBusy(value => ({ ...value, [room]: true }));
    setCommandError(undefined);
    try {
      const snapshot = await controllers[room].execute(command);
      setSnapshots(value => ({ ...value, [room]: snapshot }));
    } catch { setCommandError(room); }
    finally { commandLocks.current.delete(room); setBusy(value => ({ ...value, [room]: false })); }
  }

  async function connect(host: string) {
    const success = await session.connect(host);
    if (success) {
      setActiveRoom('device');
      await savePreferences({ address: host, mode: 'device', demoStarted: true });
    }
    return success && session.state.host === host && session.state.phase === 'connected' && preferencesRef.current.mode === 'device';
  }

  function startDemo() {
    session.disconnect();
    setActiveRoom('livingRoom');
    void savePreferences({ mode: 'demo', demoStarted: true });
  }

  const locale = resolveLanguage(preferences.language, locales[0]?.languageCode);
  const theme = resolveAppearance(preferences.appearance, systemTheme);
  const real = activeRoom === 'device';
  return { ready, preferences, savePreferences, retryLoadPreferences, resetPreferences, storageError, activeRoom, setActiveRoom, snapshots,
    snapshot: real ? deviceState.snapshot : snapshots[activeRoom], busy: real ? deviceState.busy : busy[activeRoom] ?? false,
    commandError: real ? deviceState.error : commandError === activeRoom ? 'error' as const : undefined,
    deviceState, real, connect, startDemo, refresh: () => session.refresh(),
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
