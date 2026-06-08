import type { DashboardLayout } from '../widgets/types';
import type { WellSetup } from '../well-setup/types';
import type { RigDay } from '../rig-day/types';
import type { ChannelDef } from '../data-manager/types';
import type { Vendor, AfeLine } from '../office-ops/types';

export interface LocalDbSnapshot {
  version: 1;
  exportedAt?: string;
  collections: {
    dashboards?: DashboardLayout[];
    wellSetups?: { wellId: string; setup: WellSetup }[];
    rigDays?: RigDay[];
    channels?: ChannelDef[];
    vendors?: Vendor[];
    afe?: AfeLine[];
  };
}
export interface CollectionInfo { key: string; label: string; count: number; }

const COLLECTIONS: { key: keyof LocalDbSnapshot['collections']; label: string }[] = [
  { key: 'dashboards', label: 'Dashboards' },
  { key: 'wellSetups', label: 'Well Setups' },
  { key: 'rigDays', label: 'Rig Days' },
  { key: 'channels', label: 'Channels' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'afe', label: 'AFE Lines' },
];

export function isValidSnapshot(v: unknown): v is LocalDbSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    s.version === 1 && !!s.collections && typeof s.collections === 'object' && !Array.isArray(s.collections)
  );
}

export function summarizeSnapshot(s: LocalDbSnapshot): CollectionInfo[] {
  return COLLECTIONS.map(({ key, label }) => ({
    key, label, count: Array.isArray(s.collections?.[key]) ? (s.collections[key] as unknown[]).length : 0,
  }));
}
