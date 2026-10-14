// Native components use system fonts with English and Ukrainian glyph coverage.
export const themes = {
  dark: { background: '#09090b', surface: '#18181b', border: '#3f3f46', text: '#fafafa', muted: '#a1a1aa', accent: '#818cf8', accentText: '#09090b' },
  light: { background: '#fafafa', surface: '#ffffff', border: '#d4d4d8', text: '#18181b', muted: '#52525b', accent: '#4f46e5', accentText: '#ffffff' },
} as const;
export type Theme = keyof typeof themes;
export const spacing = { small: 8, medium: 16, large: 24, section: 32 } as const;
export const radius = { card: 20, control: 12 } as const;
