import { record } from './parsers';
import type { BrowseAction, BrowsePage, Source } from './types';

export type BrowseErrorCode = 'companionOwned' | 'companionBusy' | 'browseChanged' | 'browseUnavailable' | 'browseReadError' | 'uncertainError';
export class BrowseError extends Error {
  constructor(readonly code: BrowseErrorCode) { super(code); this.name = 'BrowseError'; }
}

// These are inputs implemented by this browser, not a device capability list.
export function canBrowseSource(source: Source): boolean {
  return source.networkPlayer && ['deezer', 'server', 'usb', 'net_radio'].includes(source.id);
}

export function validBrowseIndex(index: unknown): index is number {
  return typeof index === 'number' && Number.isInteger(index) && index >= 0 && index <= 64992 && index % 8 === 0;
}

export function validBrowseAction(value: unknown): value is BrowseAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  if (typeof action.token !== 'string' || !/^\d{1,16}$/.test(action.token)) return false;
  const keys = action.type === 'back' ? ['type', 'token'] : action.type === 'search' ? ['type', 'token', 'index', 'text'] : ['type', 'token', 'index'];
  if (Object.keys(action).some(key => !keys.includes(key))) return false;
  if (action.type === 'back') return true;
  if (!['select', 'play', 'search'].includes(String(action.type)) || typeof action.index !== 'number' || !Number.isInteger(action.index) || action.index < 0 || action.index > 64999) return false;
  return action.type !== 'search' || (typeof action.text === 'string' && action.text.trim().length > 0 && action.text.length <= 256 && !/[\u0000-\u001f\u007f]/.test(action.text));
}

export function parseBrowsePage(data: Record<string, unknown>, input: string, requestedIndex: number): BrowsePage {
  const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
  if (!integer(data.menu_layer, 0, 15) || !integer(data.max_line, 0, 65000) || data.index !== requestedIndex || typeof data.menu_name !== 'string' || data.menu_name.length > 512 || !Array.isArray(data.list_info) || data.list_info.length > 8 || data.list_info.length > Math.max(0, data.max_line - requestedIndex)) throw new BrowseError('browseReadError');
  if (requestedIndex > 0 && requestedIndex >= data.max_line) throw new BrowseError('browseChanged');
  const items = data.list_info.map((value, offset) => {
    const item = record(value);
    if (typeof item.text !== 'string' || item.text.length > 512 || !integer(item.attribute, 0, 0x7fffffff)) throw new BrowseError('browseReadError');
    return { index: requestedIndex + offset, text: item.text, selectable: !!(item.attribute & 2), playable: !!(item.attribute & 4), searchable: !!(item.attribute & 8) };
  });
  return { input, token: '', layer: data.menu_layer, title: data.menu_name, index: requestedIndex, total: data.max_line, items };
}

export function sameBrowsePage(a: BrowsePage, b: BrowsePage): boolean {
  return JSON.stringify({ ...a, token: '' }) === JSON.stringify({ ...b, token: '' });
}
