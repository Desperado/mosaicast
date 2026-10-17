export interface Preferences {
  version: 1;
  appearance: 'system' | 'light' | 'dark';
  language: 'system' | 'en' | 'uk';
  demoStarted: boolean;
  mode: 'demo' | 'device';
  address: string;
  connection?: 'direct' | 'companion';
}

export const defaults: Preferences = { version: 1, appearance: 'system', language: 'system', demoStarted: false, mode: 'demo', address: '', connection: 'direct' };
export const preferencesKey = 'mosaicast.preferences.v1';

export function parsePreferences(raw: string | null): Preferences {
  if (raw === null) return { ...defaults };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) throw new Error('Invalid preferences');
  const record = value as Record<string, unknown>;
  return {
    ...defaults,
    appearance: record.appearance === 'light' || record.appearance === 'dark' ? record.appearance : 'system',
    language: record.language === 'en' || record.language === 'uk' ? record.language : 'system',
    demoStarted: record.demoStarted === true,
    mode: record.mode === 'device' ? 'device' : 'demo',
    connection: record.connection === 'companion' ? 'companion' : 'direct',
    address: typeof record.address === 'string' && record.address.length <= 15 ? record.address : '',
  };
}

export function resolveLanguage(preference: Preferences['language'], systemLanguage: string | null | undefined): 'en' | 'uk' {
  return preference === 'system' ? (systemLanguage?.split('-')[0].toLowerCase() === 'uk' ? 'uk' : 'en') : preference;
}

export function resolveAppearance(preference: Preferences['appearance'], systemAppearance: string | null | undefined): 'light' | 'dark' {
  return preference === 'system' ? (systemAppearance === 'dark' ? 'dark' : 'light') : preference;
}

// Keep asynchronous storage writes ordered. A rejected write must not poison the queue.
export function preferenceWriter(write: (value: string) => Promise<void>) {
  let pending = Promise.resolve();
  return (preferences: Preferences): Promise<void> => {
    const value = JSON.stringify(preferences);
    const result = pending.then(() => write(value));
    pending = result.catch(() => undefined);
    return result;
  };
}
