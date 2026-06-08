import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  deriveOperationsKpis,
  deriveNptBreakdown,
  deriveCostVariance,
  deriveAssetRollup,
  deriveProductivityTrend,
  DEFAULT_RIG_DAY,
  DEFAULT_AFE,
  type AssetTreeNode,
} from '@valor/core';
import {
  KpiGrid,
  NptPareto,
  CostVariancePanel,
  AssetRollupTable,
  ProductivityTrendView,
} from '@/components/data-studio-views';

const tree: AssetTreeNode[] = [
  {
    asset: { id: 'a1', orgId: 'o', name: 'Eagle Ford', region: 'TX' },
    pads: [
      {
        pad: { id: 'p1', orgId: 'o', assetId: 'a1', name: 'Pad 1' },
        wells: [{ id: 'w1', orgId: 'o', padId: 'p1', name: 'W1', status: 'drilling' }],
      },
    ],
  },
];

describe('Data Studio views', () => {
  it('KpiGrid renders one card per KPI with formatted values', () => {
    const { kpis } = deriveOperationsKpis({ rigDays: [DEFAULT_RIG_DAY], afe: DEFAULT_AFE, assetTree: tree, jobs: [] });
    render(<KpiGrid kpis={kpis} />);
    expect(screen.getAllByTestId('kpi-card')).toHaveLength(kpis.length);
    expect(screen.getByText('NPT share')).toBeInTheDocument();
    expect(screen.getByText('10.2%')).toBeInTheDocument();
  });

  it('NptPareto lists each NPT code', () => {
    render(<NptPareto data={deriveNptBreakdown([DEFAULT_RIG_DAY])} />);
    expect(screen.getAllByTestId('npt-slice')).toHaveLength(1);
    expect(screen.getByText('Rig Repair')).toBeInTheDocument();
  });

  it('CostVariancePanel renders category rows', () => {
    render(<CostVariancePanel data={deriveCostVariance(DEFAULT_AFE)} />);
    expect(screen.getAllByTestId('cost-cat').length).toBeGreaterThan(0);
  });

  it('AssetRollupTable renders a row per asset', () => {
    render(<AssetRollupTable data={deriveAssetRollup(tree, [])} />);
    expect(screen.getAllByTestId('asset-row')).toHaveLength(1);
    expect(screen.getByText('Eagle Ford')).toBeInTheDocument();
  });

  it('ProductivityTrendView renders a point per rig day', () => {
    render(<ProductivityTrendView data={deriveProductivityTrend([DEFAULT_RIG_DAY])} />);
    expect(screen.getAllByTestId('trend-point')).toHaveLength(1);
    expect(screen.getByText('Day 1')).toBeInTheDocument();
  });

  it('renders empty states without crashing', () => {
    render(<NptPareto data={deriveNptBreakdown([])} />);
    expect(screen.getByText(/No non-productive time/i)).toBeInTheDocument();
  });
});
