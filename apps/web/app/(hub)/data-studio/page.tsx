'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  DEFAULT_AFE,
  DEFAULT_RIG_DAY,
  deriveStudioAnalytics,
  type AfeLine,
  type AssetTreeNode,
  type Job,
  type RigDay,
} from '@valor/core';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/states';
import {
  AssetRollupTable,
  CostVariancePanel,
  KpiGrid,
  NptPareto,
  ProductivityTrendView,
} from '@/components/data-studio-views';

interface StudioData {
  rigDays: RigDay[];
  afe: AfeLine[];
  assetTree: AssetTreeNode[];
  jobs: Job[];
}

export default function DataStudioPage() {
  const [data, setData] = useState<StudioData | null>(null);

  useEffect(() => {
    let active = true;
    const repo = getRepo();
    // allSettled (not all): if one source fails — e.g. listJobs under RLS while
    // exportSnapshot succeeds — keep the collections that loaded and only default
    // the failed ones, rather than dropping the whole page to seed defaults.
    Promise.allSettled([
      repo.exportSnapshot(),
      repo.getAssetTree(DEMO_ORG_ID),
      repo.listJobs(DEMO_ORG_ID),
    ]).then(([snapR, treeR, jobsR]) => {
      if (!active) return;
      const snap = snapR.status === 'fulfilled' ? snapR.value : null;
      const assetTree = treeR.status === 'fulfilled' ? treeR.value : [];
      const jobs = jobsR.status === 'fulfilled' ? jobsR.value : [];
      // Fall back to the seed defaults when a collection is empty/unavailable so
      // the demo always shows meaningful analytics (mirrors the other workspaces).
      const rigDays = snap?.collections.rigDays?.length ? snap.collections.rigDays : [DEFAULT_RIG_DAY];
      const afe = snap?.collections.afe?.length ? snap.collections.afe : DEFAULT_AFE;
      setData({ rigDays, afe, assetTree, jobs });
    });
    return () => {
      active = false;
    };
  }, []);

  const analytics = useMemo(() => {
    if (!data) return null;
    // Single pass — runs each sub-derivation once and composes the KPIs from
    // them (no double work vs. calling deriveOperationsKpis + the views separately).
    return deriveStudioAnalytics(data);
  }, [data]);

  return (
    <div>
      <PageHeader
        eyebrow="Data Studio · Analytics"
        title="Data Studio"
        subtitle="Operational analytics across the hub — lost-time Pareto, cost variance, asset roll-ups, and productivity trends. Organized so the numbers do the talking."
      />

      {analytics ? (
        <div className="space-y-6">
          {analytics.kpis.warnings.length > 0 && (
            <ul className="space-y-1.5">
              {analytics.kpis.warnings.map((w, i) => (
                <li
                  key={`${w}-${i}`}
                  className="flex items-start gap-2 rounded-md border border-red/20 bg-red/[0.06] px-3 py-2 text-xs text-red"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          <KpiGrid kpis={analytics.kpis.kpis} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lost time (NPT) Pareto</CardTitle>
              </CardHeader>
              <CardContent>
                <NptPareto data={analytics.npt} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AFE cost variance</CardTitle>
              </CardHeader>
              <CardContent>
                <CostVariancePanel data={analytics.cost} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Productivity by rig day</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductivityTrendView data={analytics.trend} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cross-asset roll-up</CardTitle>
            </CardHeader>
            <CardContent>
              <AssetRollupTable data={analytics.roll} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
