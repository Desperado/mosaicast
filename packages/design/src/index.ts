// Native components use system fonts with English and Ukrainian glyph coverage.
export const themes = {
  dark: { background: '#09090b', surface: '#18181b', raised: '#242427', border: '#353539', text: '#fafafa', muted: '#a1a1aa', accent: '#818cf8', primary: '#6259ed', accentText: '#ffffff', positive: '#86cf9a', tint: '#201d39' },
  light: { background: '#fafafa', surface: '#ffffff', raised: '#efeff1', border: '#dedee2', text: '#18181b', muted: '#595961', accent: '#5141d9', primary: '#5141d9', accentText: '#ffffff', positive: '#267641', tint: '#eeebfc' },
} as const;
export type Theme = keyof typeof themes;
export const spacing = { small: 8, medium: 16, large: 24, section: 32 } as const;
export const radius = { card: 20, control: 12 } as const;
