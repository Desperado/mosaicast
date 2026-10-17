import type { TunerBand, TunerFeatures, TunerPreset, TunerState } from './types';

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const number = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const text = (value: unknown): string => typeof value === 'string' ? value.trim().slice(0, 512) : '';
export const tunerBand = (value: unknown): value is TunerBand => value === 'fm' || value === 'dab';

export function parseTunerFeatures(value: unknown): TunerFeatures | undefined {
  const data = object(value);
  const bands = (['fm', 'dab'] as const).filter(band => Array.isArray(data.func_list) && data.func_list.includes(band));
  if (!bands.length) return undefined;
  const range = object(Array.isArray(data.range_step) ? data.range_step.find(value => object(value).id === 'fm') : undefined);
  const min = number(range.min), max = number(range.max), step = number(range.step);
  const preset = object(data.preset);
  return { bands, initialScan: bands.includes('dab') && Array.isArray(data.func_list) && data.func_list.includes('dab_initial_scan'),
    fmRange: bands.includes('fm') && min !== undefined && max !== undefined && step !== undefined && min > 0 && min < max && step > 0 && step <= max - min ? { min, max, step } : undefined,
    presets: ['common', 'separate'].includes(String(preset.type)) && Number.isInteger(preset.num) && Number(preset.num) > 0 && Number(preset.num) <= 256 ? { type: preset.type as 'common' | 'separate', num: Number(preset.num) } : undefined,
  };
}

export function parseTuner(data: Record<string, unknown>, features: TunerFeatures): TunerState | undefined {
  if (!tunerBand(data.band) || !features.bands.includes(data.band)) return undefined;
  const info = object(data[data.band]), rds = object(data.rds);
  return { band: data.band, preset: Number.isInteger(info.preset) && Number(info.preset) > 0 ? Number(info.preset) : undefined,
    frequency: number(info.freq), station: text(data.band === 'fm' ? rds.program_service : info.service_label),
    text: data.band === 'fm' ? [text(rds.radio_text_a), text(rds.radio_text_b)].filter(Boolean).join(' · ') : text(info.dls),
    ready: data.band === 'fm' ? info.tuned === true : info.status === 'ready',
    scanning: data.band === 'dab' && info.status === 'initial_scan',
  };
}

export function parsePresets(data: Record<string, unknown>, features: TunerFeatures): TunerPreset[] {
  if (!features.presets || !Array.isArray(data.preset_info)) return [];
  return data.preset_info.slice(0, features.presets.num).flatMap((value, index) => {
    const item = object(value);
    return tunerBand(item.band) && features.bands.includes(item.band) && Number.isInteger(item.number) && Number(item.number) > 0
      ? [{ slot: index + 1, band: item.band, number: Number(item.number) }] : [];
  });
}
