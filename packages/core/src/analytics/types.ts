import type { RigDay } from '../rig-day/types';
import type { AfeLine } from '../office-ops/types';
import type { AssetTreeNode } from '../views';
import type { Job } from '../types';

/**
 * Data Studio analytics — cross-entity aggregation over the data the hub already
 * holds (rig-day time accounting, AFE costs, the asset hierarchy, jobs). Every
 * derive* function is pure and deterministic (no Date.now / Math.random) and
 * returns a `warnings: string[]` rather than throwing, matching the rest of
 * @valor/core. This file is types only; the functions live in ./analytics.
 */

export type KpiUnit = 'hr' | '%' | '$' | 'count';
export type KpiTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface Kpi {
  key: string;
  label: string;
  value: number;
  unit: KpiUnit;
  tone: KpiTone;
  hint?: string;
}
export interface OperationsKpis {
  kpis: Kpi[];
  warnings: string[];
}

/** One non-productive-time code, with its share of total NPT. */
export interface NptSlice {
  code: string;
  label: string;
  category: string;
  minutes: number;
  pct: number; // share of totalNptMin, 0-100, one decimal
}
export interface NptBreakdown {
  totalLoggedMin: number;
  totalNptMin: number;
  nptPct: number; // NPT share of logged time, 0-100, one decimal
  slices: NptSlice[]; // NPT codes only, sorted desc by minutes (a lost-time Pareto)
  warnings: string[];
}

export interface CostCategory {
  category: string;
  budget: number;
  actual: number;
  variance: number; // budget - actual (positive = under budget)
  pctSpent: number; // actual/budget, 0+, one decimal
}
export interface CostVariance {
  totalBudget: number;
  totalActual: number;
  variance: number;
  pctSpent: number;
  categories: CostCategory[]; // sorted desc by budget
  warnings: string[];
}

export interface AssetRollupRow {
  assetId: string;
  assetName: string;
  region?: string;
  padCount: number;
  wellCount: number;
  activeJobCount: number;
  wellsByStatus: Record<string, number>;
}
export interface AssetRollup {
  rows: AssetRollupRow[];
  totals: { assets: number; pads: number; wells: number; activeJobs: number };
  warnings: string[];
}

export interface TrendPoint {
  rigDayId: string;
  label: string;
  loggedMin: number;
  productiveMin: number;
  nptMin: number;
  productivePct: number; // productive/logged, 0-100, one decimal
}
export interface ProductivityTrend {
  points: TrendPoint[]; // in input order
  warnings: string[];
}

/** All optional — Data Studio summarizes whatever collections are present. */
export interface AnalyticsInput {
  rigDays?: RigDay[];
  afe?: AfeLine[];
  assetTree?: AssetTreeNode[];
  jobs?: Job[];
}
