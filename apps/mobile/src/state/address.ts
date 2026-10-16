// Accept locale decimal separators, but never guess missing octet boundaries.
export function normalizeAddress(value: string): string {
  return value.trim().replaceAll(',', '.');
}
