/** Coerce a possibly-malformed value to a trimmed string. Total: never throws. */
export function asTrimmed(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}
