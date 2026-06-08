'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_AFE,
  DEFAULT_RIG_DAY,
  deriveAssetRollup,
  deriveCostVariance,
  deriveNptBreakdown,
  deriveOperationsKpis,
  deriveProductivityTrend,
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
    Promise.all([repo.exportSnapshot(), repo.getAssetTree(DEMO_ORG_ID), repo.listJobs(DEMO_ORG_ID)])
      .then(([snap, assetTree, jobs]) => {
        if (!active) return;
        // Fall back to the seed defaults when a collection is empty so the demo
        // always shows meaningful analytics (mirrors the other workspaces).
        const rigDays = snap.collections.rigDays?.length ? snap.collections.rigDays : [DEFAULT_RIG_DAY];
        const afe = snap.collections.afe?.length ? snap.collections.afe : DEFAULT_AFE;
        setData({ rigDays, afe, assetTree, jobs });
      })
      .catch(() => {
        if (active) setData({ rigDays: [DEFAULT_RIG_DAY], afe: DEFAULT_AFE, assetTree: [], jobs: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  const analytics = useMemo(() => {
    if (!data) return null;
    return {
      kpis: deriveOperationsKpis(data),
      npt: deriveNptBreakdown(data.rigDays),
      cost: deriveCostVariance(data.afe),
      roll: deriveAssetRollup(data.assetTree, data.jobs),
      trend: deriveProductivityTrend(data.rigDays),
    };
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
