export const en = {
  tagline: 'Your music. Your art. Your room.',
  welcomeBody: 'A little space for music. A simpler way to make your room yours.',
  tryDemo: 'Try the demo', connectByIP: 'Connect by IP', independent: 'Independent, open source. Made for your listening room.',
  demo: 'Demo', demoNotice: 'Demo only. Rooms, tracks and controls are simulated. No device is connected.',
  listen: 'Listen', rooms: 'Rooms', connection: 'Connection', settings: 'Settings', back: 'Back', close: 'Close',
  livingRoom: 'Living room', studio: 'Studio', exampleDevice: 'Example device', simulated: 'Simulated',
  nowPlaying: 'Now playing', noTrack: 'No track information', noTrackBody: 'This example source does not provide track metadata or playback controls.',
  sources: 'Sources', source: 'Source', chooseSource: 'Choose a source', sourceHint: 'Example inputs only. A connected device will report its own available sources.',
  networkPlayback: 'Track controls', inputOnly: 'Input selection only',
  capabilities: 'Example capabilities', capabilitiesHint: 'These are demo fixtures, not capabilities read from your Yamaha.',
  volume: 'Volume', of: 'of', mute: 'Mute', unmute: 'Unmute', powerOn: 'Power on', standby: 'Standby',
  standbyTitle: 'A quiet room for now', standbyBody: 'Power on this demo room to continue listening.',
  pause: 'Pause', play: 'Play', previousTrack: 'Previous track', nextTrack: 'Next track', playing: 'Playing', paused: 'Paused', stopped: 'Stopped',
  loading: 'Getting your room ready…', error: 'The demo could not complete this action. Try again.',
  roomsTitle: 'Your listening rooms', roomsBody: 'Pick a room. Let the music meet you there.', activeRoom: 'Listening here', openRoom: 'Open room', addDevice: 'Add a device',
  connectionTitle: 'A place for your Yamaha', connectionBody: 'Find its IP address in your router’s device list or the Yamaha’s network settings.',
  previewTitle: 'Connection comes next', previewBody: 'This build is a design demo. You can save an address locally; it will not contact or control your Yamaha.',
  ipAddress: 'IP address', ipHint: 'Use a private IPv4 address, such as 192.168.1.40.', invalidIP: 'Enter a private IPv4 address. Hostnames, public addresses and addresses ending in .0 or .255 are not supported.',
  saveAddress: 'Save address', addressSaved: 'Address saved on this device. No connection was made.',
  localTitle: 'Your room, your network', localBody: 'No account or credentials needed for this demo. Your saved address stays on this device.',
  appearance: 'Appearance', language: 'Language', system: 'System', english: 'English', ukrainian: 'Українська', light: 'Light', dark: 'Dark',
  settingsBody: 'Make it feel like your room.', preferenceHint: 'System follows your device. Other languages fall back to English.',
  saveError: 'Preferences could not be saved. They will last for this session only. Try again.', retrySave: 'Save again', loadError: 'Saved preferences could not be read. Retry reading them, or reset preferences to overwrite them with defaults.',
  retryLoad: 'Read preferences again', resetPreferences: 'Reset preferences',
  about: 'Made to be open', aboutBody: 'Mosaicast · MIT licensed. An independent project, unaffiliated with Yamaha. Fictional tracks and original mosaic artwork.',
  showWelcome: 'Show welcome', demoVolume: 'Simulated volume · use − and +',
} as const;
export type TranslationKey = keyof typeof en;
export type Locale = 'en' | 'uk';
export const uk: Record<TranslationKey, string> = {
  tagline: 'Твоя музика. Твої зображення. Твоя кімната.',
  welcomeBody: 'Трохи простору для музики. Простіший спосіб зробити кімнату своєю.',
  tryDemo: 'Спробувати демо', connectByIP: 'Підключити за IP', independent: 'Незалежний, відкритий проєкт. Для твоєї музичної кімнати.',
  demo: 'Демо', demoNotice: 'Лише демо. Кімнати, композиції та керування імітовані. Пристрій не підключено.',
  listen: 'Слухати', rooms: 'Кімнати', connection: 'Підключення', settings: 'Налаштування', back: 'Назад', close: 'Закрити',
  livingRoom: 'Вітальня', studio: 'Студія', exampleDevice: 'Приклад пристрою', simulated: 'Імітація',
  nowPlaying: 'Зараз грає', noTrack: 'Немає інформації про композицію', noTrackBody: 'Це демонстраційне джерело не надає інформації про композиції чи керування відтворенням.',
  sources: 'Джерела', source: 'Джерело', chooseSource: 'Обрати джерело', sourceHint: 'Лише приклади входів. Підключений пристрій повідомить доступні джерела.',
  networkPlayback: 'Керування композиціями', inputOnly: 'Лише вибір входу',
  capabilities: 'Приклад можливостей', capabilitiesHint: 'Це приклади для демо, а не можливості, зчитані з твого Yamaha.',
  volume: 'Гучність', of: 'з', mute: 'Вимкнути звук', unmute: 'Увімкнути звук', powerOn: 'Увімкнути', standby: 'Режим очікування',
  standbyTitle: 'Поки що тиха кімната', standbyBody: 'Увімкни цю демонстраційну кімнату, щоб продовжити слухати.',
  pause: 'Пауза', play: 'Відтворити', previousTrack: 'Попередня композиція', nextTrack: 'Наступна композиція', playing: 'Грає', paused: 'Пауза', stopped: 'Зупинено',
  loading: 'Готуємо твою кімнату…', error: 'Не вдалося виконати дію в демо. Спробуй ще раз.',
  roomsTitle: 'Твої музичні кімнати', roomsBody: 'Обери кімнату. Нехай музика зустріне тебе там.', activeRoom: 'Слухаєш тут', openRoom: 'Відкрити кімнату', addDevice: 'Додати пристрій',
  connectionTitle: 'Місце для твого Yamaha', connectionBody: 'Знайди IP-адресу в списку пристроїв роутера або в мережевих налаштуваннях Yamaha.',
  previewTitle: 'Підключення — наступний крок', previewBody: 'Ця збірка — демо дизайну. Можна зберегти адресу локально; застосунок не підключатиметься до Yamaha й не керуватиме ним.',
  ipAddress: 'IP-адреса', ipHint: 'Вкажи приватну IPv4-адресу, наприклад 192.168.1.40.', invalidIP: 'Вкажи приватну IPv4-адресу. Імена хостів, публічні адреси та адреси із закінченням .0 або .255 не підтримуються.',
  saveAddress: 'Зберегти адресу', addressSaved: 'Адресу збережено на цьому пристрої. Підключення не виконано.',
  localTitle: 'Твоя кімната, твоя мережа', localBody: 'Для демо не потрібні обліковий запис чи паролі. Збережена адреса залишається на цьому пристрої.',
  appearance: 'Оформлення', language: 'Мова', system: 'Системна', english: 'English', ukrainian: 'Українська', light: 'Світла', dark: 'Темна',
  settingsBody: 'Нехай усе буде по-твоєму.', preferenceHint: 'Системний режим використовує налаштування пристрою. Для інших мов обирається англійська.',
  saveError: 'Не вдалося зберегти налаштування. Вони діятимуть лише в цьому сеансі. Спробуй ще раз.', retrySave: 'Зберегти ще раз', loadError: 'Не вдалося прочитати збережені налаштування. Спробуй прочитати їх ще раз або скинь налаштування, щоб замінити їх типовими.',
  retryLoad: 'Прочитати налаштування ще раз', resetPreferences: 'Скинути налаштування',
  about: 'Створено відкритим', aboutBody: 'Mosaicast · ліцензія MIT. Незалежний проєкт, не пов’язаний із Yamaha. Вигадані композиції та оригінальні мозаїки.',
  showWelcome: 'Показати привітання', demoVolume: 'Імітація гучності · натискай − та +',
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
