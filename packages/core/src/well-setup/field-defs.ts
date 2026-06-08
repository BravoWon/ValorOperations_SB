import type { WellSetup, WellSetupHeader, WellStatus } from './types';

export type FieldKind = 'text' | 'number' | 'code' | 'enum' | 'datetime';
export interface HeaderFieldSpec {
  key: keyof WellSetupHeader; label: string; kind: FieldKind;
  unitQuantity?: 'length'; options?: readonly string[]; group: string;
}
export const SECTION_NAMES = ['Conductor', 'Surface', 'Intermediate', 'Production'] as const;
export const WELL_STATUSES: readonly WellStatus[] = ['planned', 'in_progress', 'complete'];

export const HEADER_FIELDS: HeaderFieldSpec[] = [
  { key: 'jobCode', label: 'Job code', kind: 'code', group: 'Identity' },
  { key: 'wellApi', label: 'Well API / UWI', kind: 'text', group: 'Identity' },
  { key: 'rig', label: 'Rig', kind: 'text', group: 'Identity' },
  { key: 'wellName', label: 'Well name', kind: 'text', group: 'Identity' },
  { key: 'section', label: 'Section', kind: 'enum', options: SECTION_NAMES, group: 'Section' },
  { key: 'diameterIn', label: 'Diameter', kind: 'number', unitQuantity: 'length', group: 'Section' },
  { key: 'status', label: 'Status', kind: 'enum', options: WELL_STATUSES, group: 'Section' },
  { key: 'plannedStart', label: 'Planned start', kind: 'datetime', group: 'Schedule' },
  { key: 'plannedStop', label: 'Planned stop', kind: 'datetime', group: 'Schedule' },
  { key: 'actualStart', label: 'Actual start', kind: 'datetime', group: 'Schedule' },
  { key: 'actualStop', label: 'Actual stop', kind: 'datetime', group: 'Schedule' },
];

export interface ColumnSpec { key: string; label: string; kind: FieldKind; unitQuantity?: 'length'; }
export const CASING_COLUMNS: ColumnSpec[] = [
  { key: 'role', label: 'Role', kind: 'text' },
  { key: 'odIn', label: 'OD', kind: 'number', unitQuantity: 'length' },
  { key: 'idIn', label: 'ID', kind: 'number', unitQuantity: 'length' },
  { key: 'weightPpf', label: 'Weight (lb/ft)', kind: 'number' },
  { key: 'grade', label: 'Grade', kind: 'text' },
  { key: 'connection', label: 'Connection', kind: 'text' },
  { key: 'shoeMdFt', label: 'Shoe MD', kind: 'number', unitQuantity: 'length' },
  { key: 'shoeTvdFt', label: 'Shoe TVD', kind: 'number', unitQuantity: 'length' },
  { key: 'tocFt', label: 'TOC', kind: 'number', unitQuantity: 'length' },
];
export const HOLE_COLUMNS: ColumnSpec[] = [
  { key: 'name', label: 'Section', kind: 'text' },
  { key: 'bitDiaIn', label: 'Bit dia', kind: 'number', unitQuantity: 'length' },
  { key: 'topFt', label: 'Top', kind: 'number', unitQuantity: 'length' },
  { key: 'bottomFt', label: 'Bottom', kind: 'number', unitQuantity: 'length' },
];
export const FORMATION_COLUMNS: ColumnSpec[] = [
  { key: 'name', label: 'Formation', kind: 'text' },
  { key: 'topFt', label: 'Top', kind: 'number', unitQuantity: 'length' },
  { key: 'bottomFt', label: 'Bottom', kind: 'number', unitQuantity: 'length' },
];

export const DEFAULT_WELL_SETUP: WellSetup = {
  header: {
    jobCode: 'DRL', wellApi: '00-000-00000', rig: 'Rig 1', wellName: 'Demo Well 1',
    section: 'Production', diameterIn: 8.5, status: 'in_progress',
    plannedStart: '2026-06-07T06:00', plannedStop: '2026-06-12T06:00', actualStart: '2026-06-07T07:30', actualStop: '',
  },
  casings: [
    { role: 'Conductor', odIn: 13.375, idIn: 12.615, weightPpf: 54, grade: 'H-40', connection: 'STC', shoeMdFt: 114, shoeTvdFt: 114, tocFt: 0 },
    { role: 'Surface', odIn: 9.625, idIn: 8.835, weightPpf: 40, grade: 'J-55', connection: 'LTC', shoeMdFt: 2114, shoeTvdFt: 2114, tocFt: 0 },
    { role: 'Production', odIn: 5.5, idIn: 4.95, weightPpf: 17, grade: 'L-80', connection: 'BTC', shoeMdFt: 6400, shoeTvdFt: 6380, tocFt: 1944 },
  ],
  holes: [
    { name: 'Surface', bitDiaIn: 12.25, topFt: 114, bottomFt: 2114 },
    { name: 'Production', bitDiaIn: 8.5, topFt: 2114, bottomFt: 6400 },
  ],
  formations: [
    { name: 'Upper Shale', topFt: 1500, bottomFt: 1944 },
    { name: 'Limestone A', topFt: 1944, bottomFt: 2400 },
    { name: 'Target Sand', topFt: 6100, bottomFt: 6380 },
  ],
};
