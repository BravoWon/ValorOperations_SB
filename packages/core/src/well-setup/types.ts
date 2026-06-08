export type WellStatus = 'planned' | 'in_progress' | 'complete';

export interface WellSetupHeader {
  jobCode: string;          // FK → Bank
  wellApi: string;
  rig: string;
  wellName: string;
  section: string;          // Conductor | Surface | Intermediate | Production | ...
  diameterIn: number;       // canonical: inches
  status: WellStatus;
  plannedStart: string; plannedStop: string;
  actualStart: string; actualStop: string;
}
export interface CasingRow {
  role: string; odIn: number; idIn: number; weightPpf: number; grade: string;
  connection: string; shoeMdFt: number; shoeTvdFt: number; tocFt: number;
  cementSacks?: number; cementLeadPpg?: number; cementTailPpg?: number;
}

export interface TubingRow {
  odIn: number; idIn: number; weightPpf: number; grade: string; connection: string;
  hangerDepthFt: number; shoeDepthFt: number;
}
export type CompletionType = 'perforation' | 'packer' | 'sssv' | 'screen' | 'sliding_sleeve' | 'gas_lift_mandrel';
export interface CompletionRow { id: string; type: CompletionType; name: string; topFt: number; bottomFt?: number; shotsPerFt?: number; }
export interface WellheadInfo { workingPressurePsi?: number; tubingHeadSize?: string; casingHeadSize?: string; treeType?: string; }
export interface HoleRow { name: string; bitDiaIn: number; topFt: number; bottomFt: number; }
export interface FormationRow { name: string; topFt: number; bottomFt: number; }
export interface WellSetup {
  header: WellSetupHeader; casings: CasingRow[]; holes: HoleRow[]; formations: FormationRow[];
  tubing?: TubingRow; completions?: CompletionRow[]; wellhead?: WellheadInfo;
}
export interface WellboreModel {
  header: WellSetupHeader & { codeLabel: string };
  totalDepthFt: number;
  casings: CasingRow[];     // sorted outer→inner (od desc)
  holes: HoleRow[];         // sorted by top asc
  formations: FormationRow[]; // sorted by top asc
  warnings: string[];
  tubing?: TubingRow; completions: CompletionRow[]; wellhead?: WellheadInfo;
}
