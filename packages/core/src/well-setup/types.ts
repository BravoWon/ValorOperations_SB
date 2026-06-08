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
}
export interface HoleRow { name: string; bitDiaIn: number; topFt: number; bottomFt: number; }
export interface FormationRow { name: string; topFt: number; bottomFt: number; }
export interface WellSetup {
  header: WellSetupHeader; casings: CasingRow[]; holes: HoleRow[]; formations: FormationRow[];
}
export interface WellboreModel {
  header: WellSetupHeader & { codeLabel: string };
  totalDepthFt: number;
  casings: CasingRow[];     // sorted outer→inner (od desc)
  holes: HoleRow[];         // sorted by top asc
  formations: FormationRow[]; // sorted by top asc
  warnings: string[];
}
