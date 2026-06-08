import { describe, it, expect } from 'vitest';
import {
  deriveNptBreakdown,
  deriveCostVariance,
  deriveAssetRollup,
  deriveProductivityTrend,
  deriveOperationsKpis,
} from '../src/analytics/analytics';
import { DEFAULT_RIG_DAY } from '../src/rig-day/seed';
import type { AfeLine } from '../src/office-ops/types';
import type { AssetTreeNode } from '../src/views';
import type { Job } from '../src/types';

// DEFAULT_RIG_DAY logged = 885 min; only RIGREP (90 min) is NPT.
// productive = 795, nptPct = 90/885*100 = 10.2 (one decimal).

const afe: AfeLine[] = [
  { id: 'a1', code: '100', description: 'Rig', category: 'Drilling', budget: 100, actual: 120 },
  { id: 'a2', code: '200', description: 'Mud', category: 'Mud', budget: 50, actual: 40 },
];

function job(id: string, wellId: string, status: Job['status']): Job {
  return {
    id, orgId: 'o', wellId, templateId: 't', name: id, jobType: 'drilling', status, createdBy: 'u',
  };
}

const assetTree: AssetTreeNode[] = [
  {
    asset: { id: 'a1', orgId: 'o', name: 'Asset A', region: 'TX' },
    pads: [
      {
        pad: { id: 'p1', orgId: 'o', assetId: 'a1', name: 'Pad 1' },
        wells: [
          { id: 'w1', orgId: 'o', padId: 'p1', name: 'W1', status: 'drilling' },
          { id: 'w2', orgId: 'o', padId: 'p1', name: 'W2', status: 'producing' },
        ],
      },
    ],
  },
];

describe('deriveNptBreakdown', () => {
  it('aggregates NPT codes into a Pareto with shares', () => {
    const b = deriveNptBreakdown([DEFAULT_RIG_DAY]);
    expect(b.totalLoggedMin).toBe(885);
    expect(b.totalNptMin).toBe(90);
    expect(b.nptPct).toBe(10.2);
    expect(b.slices).toHaveLength(1);
    expect(b.slices[0]!).toMatchObject({ code: 'RIGREP', minutes: 90, pct: 100 });
  });

  it('sums across multiple rig days', () => {
    const b = deriveNptBreakdown([DEFAULT_RIG_DAY, DEFAULT_RIG_DAY]);
    expect(b.totalLoggedMin).toBe(1770);
    expect(b.totalNptMin).toBe(180);
    expect(b.slices[0]!.minutes).toBe(180);
  });

  it('warns and zeroes on empty input (never throws)', () => {
    const b = deriveNptBreakdown([]);
    expect(b.totalNptMin).toBe(0);
    expect(b.nptPct).toBe(0);
    expect(b.slices).toEqual([]);
    expect(b.warnings.length).toBeGreaterThan(0);
  });
});

describe('deriveCostVariance', () => {
  it('rolls up AFE by category with spend ratios, sorted by budget', () => {
    const c = deriveCostVariance(afe);
    expect(c.totalBudget).toBe(150);
    expect(c.totalActual).toBe(160);
    expect(c.variance).toBe(-10);
    expect(c.pctSpent).toBe(106.7);
    expect(c.categories.map((x) => x.category)).toEqual(['Drilling', 'Mud']); // budget desc
    expect(c.categories[0]!).toMatchObject({ category: 'Drilling', pctSpent: 120 });
    expect(c.categories[1]!).toMatchObject({ category: 'Mud', pctSpent: 80 });
  });

  it('warns on empty AFE without dividing by zero', () => {
    const c = deriveCostVariance([]);
    expect(c.totalBudget).toBe(0);
    expect(c.pctSpent).toBe(0);
    expect(c.warnings.length).toBeGreaterThan(0);
  });
});

describe('deriveAssetRollup', () => {
  it('counts pads/wells/active jobs and a well-status mix per asset', () => {
    const jobs = [
      job('j1', 'w1', 'executing'), // active
      job('j2', 'w1', 'mobilized'), // active
      job('j3', 'w2', 'planned'), // not active
    ];
    const r = deriveAssetRollup(assetTree, jobs);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!).toMatchObject({
      assetId: 'a1', padCount: 1, wellCount: 2, activeJobCount: 2,
    });
    expect(r.rows[0]!.wellsByStatus).toEqual({ drilling: 1, producing: 1 });
    expect(r.totals).toEqual({ assets: 1, pads: 1, wells: 2, activeJobs: 2 });
  });

  it('flags active jobs whose well is not in the tree', () => {
    const r = deriveAssetRollup(assetTree, [job('jx', 'ghost', 'executing')]);
    expect(r.totals.activeJobs).toBe(0);
    expect(r.warnings.some((w) => /not in the asset tree/.test(w))).toBe(true);
  });
});

describe('deriveProductivityTrend', () => {
  it('produces one point per rig day with productive share', () => {
    const t = deriveProductivityTrend([DEFAULT_RIG_DAY]);
    expect(t.points).toHaveLength(1);
    expect(t.points[0]!).toMatchObject({
      rigDayId: 'demo', loggedMin: 885, productiveMin: 795, nptMin: 90, productivePct: 89.8,
    });
  });
});

describe('deriveOperationsKpis', () => {
  it('composes headline KPIs from all domains', () => {
    const { kpis } = deriveOperationsKpis({
      rigDays: [DEFAULT_RIG_DAY],
      afe,
      assetTree,
      jobs: [job('j1', 'w1', 'executing')],
    });
    const kpi = (key: string) => {
      const k = kpis.find((x) => x.key === key);
      expect(k, `missing KPI ${key}`).toBeDefined();
      return k!;
    };
    expect(kpi('productiveHrs').value).toBe(13.3); // 795/60 = 13.25 → 13.3
    expect(kpi('nptHrs').value).toBe(1.5);
    expect(kpi('nptPct').value).toBe(10.2);
    expect(kpi('rigDays').value).toBe(1);
    expect(kpi('afeBudget').value).toBe(150);
    expect(kpi('afeActual').value).toBe(160);
    expect(kpi('afeActual').tone).toBe('bad'); // over budget
    expect(kpi('wells').value).toBe(2);
    expect(kpi('activeJobs').value).toBe(1);
  });

  it('warns when there is nothing to summarize', () => {
    const { warnings } = deriveOperationsKpis({});
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('propagates sub-derivation warnings (e.g. orphan active jobs)', () => {
    const { warnings } = deriveOperationsKpis({
      rigDays: [DEFAULT_RIG_DAY],
      afe,
      assetTree,
      jobs: [job('jx', 'ghost', 'executing')], // well not in the tree → orphan
    });
    expect(warnings.some((w) => /not in the asset tree/.test(w))).toBe(true);
  });
});
