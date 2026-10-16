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
  ipAddress: 'IP address', ipHint: 'Use a private IPv4 address, such as 192.168.1.40.', invalidIP: 'Enter a private IPv4 address. Hostnames, public addresses and addresses ending in .0 or .255 are not supported.',
  localTitle: 'Your room, your network', localBody: 'No account or credentials needed. The address stays on this device; controls go to your Yamaha on the local network.',
  appearance: 'Appearance', language: 'Language', system: 'System', english: 'English', ukrainian: 'Українська', light: 'Light', dark: 'Dark',
  settingsBody: 'Make it feel like your room.', preferenceHint: 'System follows your device. Other languages fall back to English.',
  saveError: 'Preferences could not be saved. They will last for this session only. Try again.', retrySave: 'Save again', loadError: 'Saved preferences could not be read. Retry reading them, or reset preferences to overwrite them with defaults.',
  retryLoad: 'Read preferences again', resetPreferences: 'Reset preferences',
  about: 'Made to be open', aboutBody: 'Mosaicast · MIT licensed. An independent project, unaffiliated with Yamaha. Fictional tracks and original mosaic artwork.',
  device: 'Yamaha', connected: 'Connected', disconnected: 'Disconnected', connecting: 'Connecting…', refresh: 'Refresh status', pending: 'Waiting for Yamaha…',
  deviceNotice: 'Live device control · changes affect your Yamaha.', connectError: 'Could not connect. Check the address, Wi-Fi, local-network permission and the browser bridge.',
  bridgeError: 'The local browser bridge is unavailable. Run npm run bridge on this laptop, keep it running, then connect or refresh again.',
  readError: 'Could not refresh. The displayed state is outdated; controls are disabled. Refresh to reconnect.',
  uncertainError: 'The command result is uncertain. It will not be retried. Refresh the device status before another command.',
  confirmed: 'Yamaha confirmed the change.', accepted: 'Yamaha accepted the skip request. A track change is not yet confirmed.',
  networkHint: 'Use the same local network. Remote power on requires Network Standby enabled on Yamaha.',
  bridgeTitle: 'Browser connection', bridgeHint: 'On this laptop, start npm run bridge. Open the preview at localhost:8091 or localhost:8081. Native iOS and Android connect directly.',
  liveCapabilities: 'Device capabilities', liveCapabilitiesHint: 'Reported by this Yamaha. Connectivity support does not mean a feature is enabled.',
  liveSourceHint: 'Inputs reported by your Yamaha. Switching sources does not start playback.',
  liveNoTrack: 'This Yamaha is not reporting track information for the selected source.',
  liveStandby: 'Yamaha is in standby. Power on requires Network Standby enabled on the device.',
  liveVolume: 'Device volume · use − and +', unavailable: 'Unavailable',
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
  ipAddress: 'IP-адреса', ipHint: 'Вкажи приватну IPv4-адресу, наприклад 192.168.1.40.', invalidIP: 'Вкажи приватну IPv4-адресу. Імена хостів, публічні адреси та адреси із закінченням .0 або .255 не підтримуються.',
  localTitle: 'Твоя кімната, твоя мережа', localBody: 'Обліковий запис і паролі не потрібні. Адреса залишається на цьому пристрої; команди надсилаються Yamaha в локальній мережі.',
  appearance: 'Оформлення', language: 'Мова', system: 'Системна', english: 'English', ukrainian: 'Українська', light: 'Світла', dark: 'Темна',
  settingsBody: 'Нехай усе буде по-твоєму.', preferenceHint: 'Системний режим використовує налаштування пристрою. Для інших мов обирається англійська.',
  saveError: 'Не вдалося зберегти налаштування. Вони діятимуть лише в цьому сеансі. Спробуй ще раз.', retrySave: 'Зберегти ще раз', loadError: 'Не вдалося прочитати збережені налаштування. Спробуй прочитати їх ще раз або скинь налаштування, щоб замінити їх типовими.',
  retryLoad: 'Прочитати налаштування ще раз', resetPreferences: 'Скинути налаштування',
  about: 'Створено відкритим', aboutBody: 'Mosaicast · ліцензія MIT. Незалежний проєкт, не пов’язаний із Yamaha. Вигадані композиції та оригінальні мозаїки.',
  device: 'Yamaha', connected: 'Підключено', disconnected: 'Не підключено', connecting: 'Підключення…', refresh: 'Оновити стан', pending: 'Очікуємо Yamaha…',
  deviceNotice: 'Керування пристроєм · дії змінюють стан твого Yamaha.', connectError: 'Не вдалося підключитися. Перевір адресу, Wi-Fi, дозвіл локальної мережі та міст для браузера.',
  bridgeError: 'Локальний міст для браузера недоступний. Запусти npm run bridge на цьому ноутбуці й залиш його працювати. Потім підключись або онови стан знову.',
  readError: 'Не вдалося оновити стан. Показані дані застарілі; керування вимкнено. Онови стан для відновлення зв’язку.',
  uncertainError: 'Результат команди невідомий. Повторного надсилання не буде. Онови стан пристрою перед наступною дією.',
  confirmed: 'Yamaha підтвердив зміну.', accepted: 'Yamaha прийняв команду перемикання. Зміна композиції ще не підтверджена.',
  networkHint: 'Потрібна та сама локальна мережа. Для ввімкнення Yamaha через мережу увімкни Network Standby на пристрої.',
  bridgeTitle: 'Підключення з браузера', bridgeHint: 'На цьому ноутбуці запусти npm run bridge. Відкрий застосунок на localhost:8091 або localhost:8081. iOS та Android підключаються напряму.',
  liveCapabilities: 'Можливості пристрою', liveCapabilitiesHint: 'Повідомлені цим Yamaha. Підтримка функції не означає, що її увімкнено.',
  liveSourceHint: 'Джерела, повідомлені Yamaha. Зміна джерела не запускає відтворення.',
  liveNoTrack: 'Yamaha не надає інформації про композицію для обраного джерела.',
  liveStandby: 'Yamaha в режимі очікування. Для ввімкнення через мережу потрібен Network Standby на пристрої.',
  liveVolume: 'Гучність пристрою · натискай − та +', unavailable: 'Недоступно',
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
