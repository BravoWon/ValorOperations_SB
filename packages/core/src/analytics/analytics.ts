import { deriveTimeAccounting } from '../rig-day/time-accounting';
import { summarizeAfe } from '../office-ops/afe';
import type { RigDay } from '../rig-day/types';
import type { AfeLine } from '../office-ops/types';
import type { AssetTreeNode } from '../views';
import type { Job } from '../types';
import type { JobStatus } from '../enums';
import type {
  AnalyticsInput,
  AssetRollup,
  AssetRollupRow,
  CostVariance,
  Kpi,
  NptBreakdown,
  NptSlice,
  OperationsKpis,
  ProductivityTrend,
  TrendPoint,
} from './types';

// A job is "active" while a rig is engaged on it — the executing lifecycle band
// between planned and complete/closed.
export const ACTIVE_JOB_STATUSES: JobStatus[] = ['mobilized', 'executing', 'suspended'];
const isActiveJob = (s: JobStatus): boolean => ACTIVE_JOB_STATUSES.includes(s);

const pct = (num: number, den: number): number => (den > 0 ? (num / den) * 100 : 0);
const round1 = (n: number): number => Math.round(n * 10) / 10;
const toHr = (min: number): number => round1(min / 60);

/**
 * Lost-time Pareto: NPT minutes grouped by Bank code across all rig days, sorted
 * descending. `nptPct` is NPT's share of all logged time; each slice's `pct` is
 * its share of total NPT.
 */
export function deriveNptBreakdown(rigDays: RigDay[]): NptBreakdown {
  const warnings: string[] = [];
  const byCode = new Map<string, NptSlice>();
  let totalLoggedMin = 0;
  let totalNptMin = 0;

  for (const rd of rigDays) {
    const ta = deriveTimeAccounting(rd.blocks ?? []);
    totalLoggedMin += ta.totalLoggedMin;
    totalNptMin += ta.nptMin;
    for (const c of ta.byCode) {
      if (!c.npt) continue;
      const slice = byCode.get(c.code) ?? {
        code: c.code,
        label: c.label,
        category: c.category,
        minutes: 0,
        pct: 0,
      };
      slice.minutes += c.minutes;
      byCode.set(c.code, slice);
    }
  }

  const slices = [...byCode.values()].sort((a, b) => b.minutes - a.minutes);
  for (const s of slices) s.pct = round1(pct(s.minutes, totalNptMin));

  if (rigDays.length === 0) warnings.push('No rig days to analyze.');
  return {
    totalLoggedMin,
    totalNptMin,
    nptPct: round1(pct(totalNptMin, totalLoggedMin)),
    slices,
    warnings,
  };
}

/** AFE cost roll-up by category with spend ratios (extends summarizeAfe). */
export function deriveCostVariance(afe: AfeLine[]): CostVariance {
  const warnings: string[] = [];
  const summary = summarizeAfe(afe);
  const categories = summary.byCategory.map((c) => ({
    category: c.category,
    budget: c.budget,
    actual: c.actual,
    variance: c.variance,
    pctSpent: round1(pct(c.actual, c.budget)),
  }));
  if (afe.length === 0) warnings.push('No AFE lines to analyze.');
  return {
    totalBudget: summary.totalBudget,
    totalActual: summary.totalActual,
    variance: summary.variance,
    pctSpent: round1(pct(summary.totalActual, summary.totalBudget)),
    categories,
    warnings,
  };
}

/**
 * Per-asset roll-up: pad/well counts, well-status mix, and active-job count.
 * Active jobs are matched to assets through their well (wellId → asset via the
 * tree). Jobs whose well is absent from the tree are counted as orphans.
 */
export function deriveAssetRollup(assetTree: AssetTreeNode[], jobs: Job[]): AssetRollup {
  const warnings: string[] = [];
  const wellToAsset = new Map<string, string>();

  const rows: AssetRollupRow[] = assetTree.map((node) => {
    const wells = node.pads.flatMap((p) => p.wells);
    for (const w of wells) wellToAsset.set(w.id, node.asset.id);
    const wellsByStatus: Record<string, number> = {};
    for (const w of wells) {
      const status = w.status ?? 'unknown';
      wellsByStatus[status] = (wellsByStatus[status] ?? 0) + 1;
    }
    return {
      assetId: node.asset.id,
      assetName: node.asset.name,
      region: node.asset.region,
      padCount: node.pads.length,
      wellCount: wells.length,
      activeJobCount: 0,
      wellsByStatus,
    };
  });

  const rowByAsset = new Map(rows.map((r) => [r.assetId, r]));
  let orphanActiveJobs = 0;
  for (const job of jobs) {
    if (!isActiveJob(job.status)) continue;
    const assetId = wellToAsset.get(job.wellId);
    const row = assetId ? rowByAsset.get(assetId) : undefined;
    if (row) row.activeJobCount += 1;
    else orphanActiveJobs += 1;
  }

  if (assetTree.length === 0) warnings.push('No assets to roll up.');
  if (orphanActiveJobs > 0) {
    warnings.push(`${orphanActiveJobs} active job(s) reference a well not in the asset tree.`);
  }

  return {
    rows,
    totals: {
      assets: rows.length,
      pads: rows.reduce((s, r) => s + r.padCount, 0),
      wells: rows.reduce((s, r) => s + r.wellCount, 0),
      activeJobs: rows.reduce((s, r) => s + r.activeJobCount, 0),
    },
    warnings,
  };
}

/** Per-rig-day productive vs NPT minutes — the productivity time series. */
export function deriveProductivityTrend(rigDays: RigDay[]): ProductivityTrend {
  const warnings: string[] = [];
  const points: TrendPoint[] = rigDays.map((rd) => {
    const ta = deriveTimeAccounting(rd.blocks ?? []);
    return {
      rigDayId: rd.id,
      label: rd.label,
      loggedMin: ta.totalLoggedMin,
      productiveMin: ta.productiveMin,
      nptMin: ta.nptMin,
      productivePct: round1(pct(ta.productiveMin, ta.totalLoggedMin)),
    };
  });
  if (rigDays.length === 0) warnings.push('No rig days to trend.');
  return { points, warnings };
}

/** Headline KPI cards composed from the per-domain derivations above. */
export function deriveOperationsKpis(input: AnalyticsInput): OperationsKpis {
  const rigDays = input.rigDays ?? [];
  const afe = input.afe ?? [];
  const assetTree = input.assetTree ?? [];
  const jobs = input.jobs ?? [];

  const npt = deriveNptBreakdown(rigDays);
  const cost = deriveCostVariance(afe);
  const roll = deriveAssetRollup(assetTree, jobs);
  const productiveMin = npt.totalLoggedMin - npt.totalNptMin;

  const kpis: Kpi[] = [
    { key: 'productiveHrs', label: 'Productive time', value: toHr(productiveMin), unit: 'hr', tone: 'good' },
    { key: 'nptHrs', label: 'NPT', value: toHr(npt.totalNptMin), unit: 'hr', tone: npt.totalNptMin > 0 ? 'warn' : 'neutral' },
    {
      key: 'nptPct',
      label: 'NPT share',
      value: npt.nptPct,
      unit: '%',
      tone: npt.nptPct >= 15 ? 'bad' : npt.nptPct > 0 ? 'warn' : 'neutral',
      hint: 'of logged time',
    },
    { key: 'rigDays', label: 'Rig days logged', value: rigDays.length, unit: 'count', tone: 'neutral' },
    { key: 'afeBudget', label: 'AFE budget', value: cost.totalBudget, unit: '$', tone: 'neutral' },
    {
      key: 'afeActual',
      label: 'AFE actual',
      value: cost.totalActual,
      unit: '$',
      tone: cost.variance < 0 ? 'bad' : 'good',
      hint: cost.variance >= 0 ? 'under budget' : 'over budget',
    },
    { key: 'wells', label: 'Wells', value: roll.totals.wells, unit: 'count', tone: 'neutral' },
    { key: 'activeJobs', label: 'Active jobs', value: roll.totals.activeJobs, unit: 'count', tone: 'neutral' },
  ];

  const warnings: string[] = [];
  if (rigDays.length === 0 && afe.length === 0 && assetTree.length === 0) {
    warnings.push('No data available to summarize.');
  }
  return { kpis, warnings };
}
