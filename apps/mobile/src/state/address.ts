// Accept locale decimal separators, but never guess missing octet boundaries.
export function normalizeAddress(value: string): string {
  return value.trim().replaceAll(',', '.');
}

// The keyboard toolbar must insert at the caret, including over a selection.
export function insertAddressDot(value: string, selection: { start: number; end: number }) {
  const start = Math.max(0, Math.min(value.length, selection.start));
  const end = Math.max(start, Math.min(value.length, selection.end));
  const address = `${value.slice(0, start)}.${value.slice(end)}`;
  if (address.length > 64) return { address: value, selection: { start, end } };
  return { address, selection: { start: start + 1, end: start + 1 } };
}
