import type { WellSetup, WellSetupHeader, WellStatus, CompletionType, WellheadInfo } from './types';

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
  { key: 'cementSacks', label: 'Cement (sx)', kind: 'number' },
  { key: 'cementLeadPpg', label: 'Lead (ppg)', kind: 'number' },
  { key: 'cementTailPpg', label: 'Tail (ppg)', kind: 'number' },
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

export const COMPLETION_TYPES: { value: CompletionType; label: string }[] = [
  { value: 'perforation', label: 'Perforation' },
  { value: 'packer', label: 'Packer' },
  { value: 'sssv', label: 'SSSV' },
  { value: 'screen', label: 'Screen' },
  { value: 'sliding_sleeve', label: 'Sliding Sleeve' },
  { value: 'gas_lift_mandrel', label: 'Gas-Lift Mandrel' },
];

export const TUBING_FIELDS: ColumnSpec[] = [
  { key: 'odIn', label: 'OD', kind: 'number', unitQuantity: 'length' },
  { key: 'idIn', label: 'ID', kind: 'number', unitQuantity: 'length' },
  { key: 'weightPpf', label: 'Weight (lb/ft)', kind: 'number' },
  { key: 'grade', label: 'Grade', kind: 'text' },
  { key: 'connection', label: 'Connection', kind: 'text' },
  { key: 'hangerDepthFt', label: 'Hanger depth', kind: 'number', unitQuantity: 'length' },
  { key: 'shoeDepthFt', label: 'Shoe depth', kind: 'number', unitQuantity: 'length' },
];

export const COMPLETION_COLUMNS: ColumnSpec[] = [
  { key: 'name', label: 'Name', kind: 'text' },
  { key: 'topFt', label: 'Top', kind: 'number', unitQuantity: 'length' },
  { key: 'bottomFt', label: 'Bottom', kind: 'number', unitQuantity: 'length' },
  { key: 'shotsPerFt', label: 'Shots/ft', kind: 'number' },
];

export const WELLHEAD_FIELDS: { key: keyof WellheadInfo; label: string; kind: 'number' | 'text' }[] = [
  { key: 'workingPressurePsi', label: 'Working pressure (psi)', kind: 'number' },
  { key: 'tubingHeadSize', label: 'Tubing head size', kind: 'text' },
  { key: 'casingHeadSize', label: 'Casing head size', kind: 'text' },
  { key: 'treeType', label: 'Tree type', kind: 'text' },
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
    { role: 'Production', odIn: 5.5, idIn: 4.95, weightPpf: 17, grade: 'L-80', connection: 'BTC', shoeMdFt: 6400, shoeTvdFt: 6380, tocFt: 1944, cementSacks: 765, cementLeadPpg: 12.5, cementTailPpg: 15.7 },
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
  tubing: { odIn: 2.875, idIn: 2.441, weightPpf: 6.5, grade: 'L-80', connection: 'EUE', hangerDepthFt: 0, shoeDepthFt: 6300 },
  completions: [
    { id: 'comp-1', type: 'sssv', name: 'Surface Safety Valve', topFt: 1000 },
    { id: 'comp-2', type: 'packer', name: 'Production Packer', topFt: 6280 },
    { id: 'comp-3', type: 'perforation', name: 'Target Sand Perfs', topFt: 6100, bottomFt: 6380, shotsPerFt: 6 },
  ],
  wellhead: { workingPressurePsi: 5000, tubingHeadSize: '11 in', casingHeadSize: '13-5/8 in', treeType: 'Conventional' },
};
