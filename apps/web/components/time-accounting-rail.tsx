'use client';

import { AlertTriangle } from 'lucide-react';
import type { TimeAccounting } from '@valor/core';

export interface TimeAccountingRailProps {
  accounting: TimeAccounting;
}

/** minutes → `h:mm` (e.g. 90 → "1:30"). */
function hMM(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, '0')}`;
}

export function TimeAccountingRail({ accounting }: TimeAccountingRailProps) {
  const { productiveMin, nptMin, byCode, unaccountedGaps } = accounting;
  // Scale bars against the largest single-code tally so the widest reads full.
  const maxMinutes = byCode.reduce((m, c) => Math.max(m, c.minutes), 0) || 1;

  return (
    <div className="space-y-4">
      {/* Headline: productive vs NPT */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-gold/20 bg-gold/[0.05] px-3 py-2.5">
          <div className="eyebrow mb-1">Productive</div>
          <div className="font-mono text-xl font-semibold tabular-nums text-gold-light">
            {hMM(productiveMin)}
          </div>
        </div>
        <div className="rounded-md border border-red/25 bg-red/[0.06] px-3 py-2.5">
          <div className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-red/80">
            NPT
          </div>
          <div className="font-mono text-xl font-semibold tabular-nums text-red">
            {hMM(nptMin)}
          </div>
        </div>
      </div>

      {/* Per-code tallies */}
      <div className="space-y-1.5">
        <div className="eyebrow">Hours by Activity</div>
        {byCode.map((c) => {
          const widthPct = (c.minutes / maxMinutes) * 100;
          return (
            <div key={c.code} data-testid="code-tally" className="space-y-0.5">
              <div className="flex items-baseline justify-between font-mono text-[0.6875rem]">
                <span className={c.npt ? 'text-red' : 'text-cream/90'}>
                  {`${c.code} · ${c.label}`}
                </span>
                <span className="tabular-nums text-muted-foreground/70">{hMM(c.minutes)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-sm bg-white/[0.04]">
                <div
                  className={c.npt ? 'h-full rounded-sm bg-red' : 'h-full rounded-sm bg-gold'}
                  style={{ width: `${widthPct}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
        {byCode.length === 0 && (
          <p className="font-mono text-xs text-muted-foreground/50">No logged time yet.</p>
        )}
      </div>

      {/* Unaccounted gaps chip */}
      {unaccountedGaps.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red/20 bg-red/[0.05] px-3 py-2 text-xs text-red">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span>
            {`${unaccountedGaps.length} unaccounted ${
              unaccountedGaps.length === 1 ? 'gap' : 'gaps'
            } · ${hMM(
              unaccountedGaps.reduce((sum, g) => sum + (g.endMin - g.startMin), 0),
            )}`}
          </span>
        </div>
      )}
    </div>
  );
}
