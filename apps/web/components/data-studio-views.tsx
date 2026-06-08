'use client';

import type {
  AssetRollup,
  CostVariance,
  Kpi,
  NptBreakdown,
  ProductivityTrend,
} from '@valor/core';

/**
 * Data Studio presentational views — pure, prop-driven renderers for the
 * analytics derivations in @valor/core. No data loading or compute here (the
 * page does that); these just paint KPIs, the NPT Pareto, cost variance, the
 * asset roll-up table, and the productivity trend. Bars are CSS (matching
 * AfeSummaryStrip) — no chart dependency.
 */

const money = (n: number): string => `$${Math.round(n).toLocaleString()}`;
const hm = (min: number): string => {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};
const varianceClass = (v: number): string => (v >= 0 ? 'text-green' : 'text-red');

// --- KPI grid ---------------------------------------------------------------

const TONE_CLASS: Record<Kpi['tone'], string> = {
  good: 'text-green',
  warn: 'text-gold-light',
  bad: 'text-red',
  neutral: 'text-cream',
};

function formatKpi(k: Kpi): string {
  switch (k.unit) {
    case '$':
      return money(k.value);
    case '%':
      return `${k.value}%`;
    case 'hr':
      return `${k.value} h`;
    default:
      return `${k.value}`;
  }
}

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {kpis.map((k) => (
        <div
          key={k.key}
          data-testid="kpi-card"
          className="rounded-md border border-white/[0.06] bg-background/30 px-4 py-3"
        >
          <div className="eyebrow mb-1 truncate">{k.label}</div>
          <div className={`font-display text-2xl font-medium tracking-tight ${TONE_CLASS[k.tone]}`}>
            {formatKpi(k)}
          </div>
          {k.hint && (
            <div className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/60">
              {k.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- NPT Pareto -------------------------------------------------------------

export function NptPareto({ data }: { data: NptBreakdown }) {
  if (data.slices.length === 0) {
    return (
      <p className="text-sm text-muted-foreground/70">
        No non-productive time logged — nothing to break down.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-4">
        <div>
          <div className="eyebrow mb-1">Total NPT</div>
          <div className="font-display text-2xl font-medium tracking-tight text-red">
            {hm(data.totalNptMin)}
          </div>
        </div>
        <div>
          <div className="eyebrow mb-1">NPT share</div>
          <div className="font-display text-2xl font-medium tracking-tight text-gold-light">
            {data.nptPct}%
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {data.slices.map((s) => (
          <div
            key={s.code}
            data-testid="npt-slice"
            className="grid grid-cols-[9rem_1fr_auto] items-center gap-3 rounded-md border border-white/[0.05] bg-background/20 px-3 py-2"
          >
            <span className="truncate font-mono text-xs text-cream" title={`${s.label} · ${s.category}`}>
              {s.label}
            </span>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-red/70" style={{ width: `${s.pct}%` }} />
            </div>
            <div className="text-right font-mono text-[0.6875rem] text-muted-foreground/80">
              {hm(s.minutes)} · {s.pct}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Cost variance ----------------------------------------------------------

export function CostVariancePanel({ data }: { data: CostVariance }) {
  if (data.categories.length === 0) {
    return <p className="text-sm text-muted-foreground/70">No AFE lines to analyze.</p>;
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-white/[0.06] bg-background/30 px-4 py-3">
          <div className="eyebrow mb-1">Budget</div>
          <div className="font-display text-2xl font-medium tracking-tight text-cream">
            {money(data.totalBudget)}
          </div>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-background/30 px-4 py-3">
          <div className="eyebrow mb-1">Actual</div>
          <div className="font-display text-2xl font-medium tracking-tight text-cream">
            {money(data.totalActual)}
          </div>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-background/30 px-4 py-3">
          <div className="eyebrow mb-1">Variance</div>
          <div className={`font-display text-2xl font-medium tracking-tight ${varianceClass(data.variance)}`}>
            {data.variance >= 0 ? '+' : '−'}
            {money(Math.abs(data.variance))}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="eyebrow">By category · spend vs budget</div>
        {data.categories.map((c) => (
          <div
            key={c.category}
            data-testid="cost-cat"
            className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 rounded-md border border-white/[0.05] bg-background/20 px-3 py-2"
          >
            <span className="truncate font-mono text-xs text-cream">{c.category}</span>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${c.pctSpent > 100 ? 'bg-red/70' : 'bg-green/70'}`}
                style={{ width: `${Math.min(c.pctSpent, 100)}%` }}
              />
            </div>
            <div className="text-right">
              <div className="font-mono text-[0.6875rem] text-muted-foreground/70">
                {money(c.actual)} / {money(c.budget)}
              </div>
              <div className={`font-mono text-[0.6875rem] ${c.pctSpent > 100 ? 'text-red' : 'text-green'}`}>
                {c.pctSpent}% spent
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Asset roll-up table ----------------------------------------------------

function statusMix(byStatus: Record<string, number>): string {
  const entries = Object.entries(byStatus);
  if (entries.length === 0) return '—';
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => `${n} ${s}`)
    .join(', ');
}

export function AssetRollupTable({ data }: { data: AssetRollup }) {
  if (data.rows.length === 0) {
    return <p className="text-sm text-muted-foreground/70">No assets to roll up.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] text-left">
            {['Asset', 'Region', 'Pads', 'Wells', 'Active jobs', 'Well status'].map((h) => (
              <th key={h} className="eyebrow px-3 py-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.assetId} data-testid="asset-row" className="border-b border-white/[0.04]">
              <td className="px-3 py-2 font-medium text-cream">{r.assetName}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground/80">{r.region ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-xs text-cream">{r.padCount}</td>
              <td className="px-3 py-2 font-mono text-xs text-cream">{r.wellCount}</td>
              <td className="px-3 py-2 font-mono text-xs text-gold-light">{r.activeJobCount}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground/80">
                {statusMix(r.wellsByStatus)}
              </td>
            </tr>
          ))}
          <tr className="text-cream">
            <td className="px-3 py-2 font-mono text-xs uppercase tracking-wider text-muted-foreground/70">
              Total
            </td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 font-mono text-xs">{data.totals.pads}</td>
            <td className="px-3 py-2 font-mono text-xs">{data.totals.wells}</td>
            <td className="px-3 py-2 font-mono text-xs text-gold-light">{data.totals.activeJobs}</td>
            <td className="px-3 py-2" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// --- Productivity trend -----------------------------------------------------

export function ProductivityTrendView({ data }: { data: ProductivityTrend }) {
  if (data.points.length === 0) {
    return <p className="text-sm text-muted-foreground/70">No rig days to trend.</p>;
  }
  return (
    <div className="space-y-2">
      {data.points.map((p) => {
        const denom = Math.max(p.loggedMin, 1);
        const prodPct = (p.productiveMin / denom) * 100;
        const nptPct = (p.nptMin / denom) * 100;
        return (
          <div
            key={p.rigDayId}
            data-testid="trend-point"
            className="grid grid-cols-[7rem_1fr_auto] items-center gap-3"
          >
            <span className="truncate font-mono text-xs text-cream">{p.label}</span>
            <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full bg-green/70" style={{ width: `${prodPct}%` }} title={`Productive ${hm(p.productiveMin)}`} />
              <div className="h-full bg-red/70" style={{ width: `${nptPct}%` }} title={`NPT ${hm(p.nptMin)}`} />
            </div>
            <span className="text-right font-mono text-[0.6875rem] text-muted-foreground/80">
              {p.productivePct}% prod
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-4 pt-1 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/60">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green/70" /> Productive
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red/70" /> NPT
        </span>
      </div>
    </div>
  );
}
