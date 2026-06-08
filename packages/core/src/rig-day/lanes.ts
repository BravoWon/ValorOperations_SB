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
  const pts: ProgressPoint[] = [];
  for (const b of withDepth) {
    const a = { atMin: b.startMin, depthFt: b.depthStartFt as number };
    const c = { atMin: b.endMin, depthFt: b.depthEndFt as number };
    const last = pts[pts.length - 1];
    if (!last || last.atMin !== a.atMin || last.depthFt !== a.depthFt) pts.push(a);
    pts.push(c);
  }
  return pts;
}
