'use client';

import type { AfeSummary } from '@valor/core';

export interface AfeSummaryStripProps {
  summary: AfeSummary;
}

/** Whole-dollar currency, no cents — e.g. `$450,000`. */
function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

/** Variance is favorable (under budget) when budget ≥ actual. */
function varianceClass(variance: number): string {
  return variance >= 0 ? 'text-green' : 'text-red';
}

export function AfeSummaryStrip({ summary }: AfeSummaryStripProps) {
  const { totalBudget, totalActual, variance, byCategory } = summary;

  return (
    <div className="space-y-5">
      {/* Headline totals */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-white/[0.06] bg-background/30 px-4 py-3">
          <div className="eyebrow mb-1">Total Budget</div>
          <div className="font-display text-2xl font-medium tracking-tight text-cream">
            {fmt(totalBudget)}
          </div>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-background/30 px-4 py-3">
          <div className="eyebrow mb-1">Total Actual</div>
          <div className="font-display text-2xl font-medium tracking-tight text-cream">
            {fmt(totalActual)}
          </div>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-background/30 px-4 py-3">
          <div className="eyebrow mb-1">Variance</div>
          <div className={`font-display text-2xl font-medium tracking-tight ${varianceClass(variance)}`}>
            {variance >= 0 ? '+' : '−'}
            {fmt(Math.abs(variance))}
          </div>
        </div>
      </div>

      {/* Per-category roll-up */}
      <div className="space-y-2">
        <div className="eyebrow">By Category</div>
        {byCategory.map((c) => {
          const denom = Math.max(c.budget, c.actual, 1);
          const budgetPct = (c.budget / denom) * 100;
          const actualPct = (c.actual / denom) * 100;
          return (
            <div
              key={c.category}
              data-testid="afe-cat"
              className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 rounded-md border border-white/[0.05] bg-background/20 px-3 py-2"
            >
              <span className="truncate font-mono text-xs text-cream">{c.category}</span>
              <div className="space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gold/70"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${c.variance >= 0 ? 'bg-green/70' : 'bg-red/70'}`}
                    style={{ width: `${actualPct}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[0.6875rem] text-muted-foreground/70">
                  {fmt(c.budget)} / {fmt(c.actual)}
                </div>
                <div className={`font-mono text-[0.6875rem] ${varianceClass(c.variance)}`}>
                  {c.variance >= 0 ? '+' : '−'}
                  {fmt(Math.abs(c.variance))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
