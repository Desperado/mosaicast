import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocales } from 'expo-localization';
import { themes } from '@mosaicast/design';
import { translate, type TranslationKey } from '@mosaicast/i18n';
import { demoController, type Command, type Snapshot } from '@mosaicast/musiccast';
import { defaults, parsePreferences, preferenceWriter, preferencesKey, resolveAppearance, resolveLanguage, type Preferences } from './preferences';

export const demoRooms = ['livingRoom', 'studio'] as const;
type Room = typeof demoRooms[number];

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
  const [snapshots, setSnapshots] = useState<Partial<Record<Room, Snapshot>>>({});
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

  const locale = resolveLanguage(preferences.language, locales[0]?.languageCode);
  const theme = resolveAppearance(preferences.appearance, systemTheme);
  return { ready, preferences, savePreferences, retryLoadPreferences, resetPreferences, storageError, activeRoom, setActiveRoom, snapshots,
    snapshot: snapshots[activeRoom], busy: busy[activeRoom] ?? false, commandError: commandError === activeRoom,
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
