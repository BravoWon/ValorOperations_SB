/**
 * Next `${prefix}${n}` id whose numeric suffix exceeds every existing matching id.
 * Collision-safe across add/remove cycles (unlike a length-based counter).
 */
export function nextSuffixId(prefix: string, ids: string[]): string {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  const maxN = ids.reduce((m, id) => {
    const n = Number(re.exec(id)?.[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${maxN + 1}`;
}
