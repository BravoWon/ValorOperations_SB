import type { TimeBlock } from './types';

export interface LaneItem { id: string; code: string; label: string; startMin: number; endMin: number; }
export interface CatalogCode { code: string; label: string; group: string; }

export const PARTY_ROLES: CatalogCode[] = [
  { code: 'OPREP', label: 'Operator Rep', group: 'Operator' },
  { code: 'COMPANY', label: 'Company Representative', group: 'Operator' },
  { code: 'DD', label: 'Directional Driller', group: 'Service' },
  { code: 'MWD', label: 'MWD Tech', group: 'Service' },
  { code: 'MUD', label: 'Mud Engineer', group: 'Service' },
  { code: 'CMTCRW', label: 'Cement Crew', group: 'Vendor' },
  { code: 'WLCRW', label: 'Wireline Crew', group: 'Vendor' },
  { code: 'INSP', label: 'Inspector', group: 'Visitor' },
  { code: 'VISITOR', label: 'Visitor', group: 'Visitor' },
  { code: 'DRIVER', label: 'Equipment Driver', group: 'Vendor' },
];

export const EQUIPMENT_CATEGORIES: CatalogCode[] = [
  { code: 'RIG', label: 'Rig', group: 'Rig' },
  { code: 'PUMPS', label: 'Mud Pumps', group: 'Circulation' },
  { code: 'BOP', label: 'BOP Stack', group: 'Pressure' },
  { code: 'TANKS', label: 'Tanks / Pits', group: 'Fluids' },
  { code: 'POWER', label: 'Power / Generators', group: 'Power' },
  { code: 'WLUNIT', label: 'Wireline Unit', group: 'Service' },
  { code: 'CMTUNIT', label: 'Cement Unit', group: 'Service' },
  { code: 'TOOLS', label: 'Tools / BHA', group: 'Downhole' },
];

export function findPartyRole(code: string): CatalogCode | undefined {
  return PARTY_ROLES.find((c) => c.code === code);
}
export function findEquipmentCategory(code: string): CatalogCode | undefined {
  return EQUIPMENT_CATEGORIES.find((c) => c.code === code);
}

export interface ProgressPoint { atMin: number; depthFt: number; }

export function deriveProgress(blocks: TimeBlock[]): ProgressPoint[] {
  const withDepth = blocks
    .filter((b) => Number.isFinite(b.depthStartFt) && Number.isFinite(b.depthEndFt))
    .sort((a, b) => a.startMin - b.startMin);
  const raw: ProgressPoint[] = [];
  for (const b of withDepth) {
    raw.push({ atMin: b.startMin, depthFt: b.depthStartFt as number });
    raw.push({ atMin: b.endMin, depthFt: b.depthEndFt as number });
  }
  // Global time sort so overlapping blocks can't yield a decreasing curve.
  raw.sort((p, q) => p.atMin - q.atMin);
  const pts: ProgressPoint[] = [];
  for (const p of raw) {
    const last = pts[pts.length - 1];
    if (!last || last.atMin !== p.atMin || last.depthFt !== p.depthFt) pts.push(p);
  }
  return pts;
}
