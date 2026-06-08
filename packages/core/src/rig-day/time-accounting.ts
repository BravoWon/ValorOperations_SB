import { DAY_MINUTES } from './types';
import type { TimeBlock, TimeAccounting, CodeTally } from './types';
import { findBankCode } from '../well-setup/bank';

export { DAY_MINUTES };

export function snapTo5(min: number): number {
  if (!Number.isFinite(min)) return 0;
  const clamped = Math.max(0, Math.min(DAY_MINUTES, min));
  return Math.round(clamped / 5) * 5;
}

export function deriveTimeAccounting(blocks: TimeBlock[], nowMin?: number): TimeAccounting {
  const warnings: string[] = [];
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);
  const tallies = new Map<string, CodeTally>();
  let totalLoggedMin = 0, nptMin = 0, prevEnd = -Infinity;

  for (const b of sorted) {
    const dur = b.endMin - b.startMin;
    if (dur <= 0) { warnings.push(`Block "${b.code}" has a non-positive span.`); continue; }
    if (b.startMin < prevEnd) warnings.push(`Blocks overlap near ${b.startMin} min.`);
    prevEnd = Math.max(prevEnd, b.endMin);
    const code = findBankCode(b.code);
    if (!code) warnings.push(`Code "${b.code}" is not in the Bank.`);
    const t = tallies.get(b.code) ?? {
      code: b.code, label: code?.label ?? b.code, category: code?.category ?? '—',
      minutes: 0, npt: code?.npt ?? false, billable: code?.billable ?? false,
    };
    t.minutes += dur;
    tallies.set(b.code, t);
    totalLoggedMin += dur;
    if (t.npt) nptMin += dur;
  }

  const byCode = [...tallies.values()].sort((a, b) => b.minutes - a.minutes);
  const now = Number.isFinite(nowMin as number)
    ? (nowMin as number)
    : sorted.length ? Math.max(...sorted.map((b) => b.endMin)) : 0;

  const merged: { s: number; e: number }[] = [];
  for (const b of sorted) {
    if (b.endMin <= b.startMin) continue;
    const last = merged[merged.length - 1];
    if (last && b.startMin <= last.e) last.e = Math.max(last.e, b.endMin);
    else merged.push({ s: b.startMin, e: b.endMin });
  }
  const unaccountedGaps: { startMin: number; endMin: number }[] = [];
  let cursor = 0;
  for (const m of merged) {
    if (m.s > cursor && cursor < now) unaccountedGaps.push({ startMin: cursor, endMin: Math.min(m.s, now) });
    cursor = Math.max(cursor, m.e);
    if (cursor >= now) break;
  }
  if (cursor < now) unaccountedGaps.push({ startMin: cursor, endMin: now });

  return { totalLoggedMin, productiveMin: totalLoggedMin - nptMin, nptMin, byCode, unaccountedGaps, warnings };
}
