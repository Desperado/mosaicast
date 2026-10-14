export const en = {
  tagline: 'Your listening room',
  foundation: 'Mobile foundation',
  demoNotice: 'Demo only. All rooms, tracks and controls below are simulated. No device is connected.',
  room: 'Example listening room',
  nowPlaying: 'Now playing',
  noTrack: 'No track information',
  sources: 'Sources',
  capabilities: 'Example capabilities',
  volume: 'Volume',
  powerOn: 'Power on',
  standby: 'Standby',
  pause: 'Pause',
  play: 'Play',
  light: 'Light',
  dark: 'Dark',
  loading: 'Loading demo…',
  error: 'The demo could not complete this action.',
  next: 'Next: native connection, Listen, Rooms and Library screens from the design handoff.',
} as const;
export type TranslationKey = keyof typeof en;
export type Locale = 'en' | 'uk';
export const uk: Record<TranslationKey, string> = {
  tagline: 'Ваша музична кімната',
  foundation: 'Основа мобільного застосунку',
  demoNotice: 'Лише демо. Усі кімнати, композиції та елементи керування нижче імітовані. Пристрій не підключено.',
  room: 'Приклад музичної кімнати',
  nowPlaying: 'Зараз грає',
  noTrack: 'Немає інформації про композицію',
  sources: 'Джерела',
  capabilities: 'Приклад можливостей',
  volume: 'Гучність',
  powerOn: 'Увімкнути',
  standby: 'Режим очікування',
  pause: 'Пауза',
  play: 'Відтворити',
  light: 'Світла',
  dark: 'Темна',
  loading: 'Завантаження демо…',
  error: 'Не вдалося виконати цю дію в демо.',
  next: 'Далі: підключення пристроїв, екрани відтворення, кімнат і бібліотеки за макетом.',
};
export const dictionaries = { en, uk };
export function translate(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key];
}

// Service names remain trademarks; descriptive source names are translated.
const ukrainianSources: Record<string, string> = {
  server: 'ПК / NAS', usb: 'USB', cd: 'CD', tuner: 'FM / DAB',
  net_radio: 'Інтернет-радіо', aux: 'AUX', digital: 'Цифровий вхід', mc_link: 'MusicCast Link',
};
const ukrainianConnectivity: Record<string, string> = {
  Ethernet: 'Ethernet', 'Wi-Fi': 'Wi-Fi', AirPlay: 'AirPlay',
  'Network standby': 'Мережевий режим очікування',
  'Wireless Direct': 'Wireless Direct', 'Bluetooth output': 'Вихід Bluetooth',
};
export function sourceLabel(locale: Locale, id: string, fallback: string): string {
  return locale === 'uk' ? ukrainianSources[id] ?? fallback : fallback;
}
export function connectivityLabel(locale: Locale, label: string): string {
  return locale === 'uk' ? ukrainianConnectivity[label] ?? label : label;
}
