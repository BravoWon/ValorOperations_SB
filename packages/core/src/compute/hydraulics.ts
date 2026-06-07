export interface HydraulicsInputs {
  holeDiameterIn: number;
  pipeOdIn: number;
  pipeIdIn: number;
  measuredDepthFt: number;
  trueVerticalDepthFt: number;
  mudWeightPpg: number;
  pumpLinerIdIn: number;
  pumpStrokeLengthIn: number;
  pumpEfficiencyPct: number;
  spm: number;
}

export interface HydraulicsResult {
  annularCapacityBblPerFt: number;
  pipeCapacityBblPerFt: number;
  annularVolumeBbl: number;
  pumpOutputBblPerStk: number;
  flowRateGpm: number;
  bottomsUpStrokes: number;
  bottomsUpTimeMin: number;
  annularVelocityFtPerMin: number;
  hydrostaticPressurePsi: number;
  warnings: string[];
}

// bbl/stroke per (in^2 * in), triplex single-acting. (Derived from the standard
// (pi/4 * ID^2 * stroke * 3 cylinders) / (231 in^3/gal * 42 gal/bbl); ~0.0002429.)
const PUMP_TRIPLEX_FACTOR = 0.000243;
// in^2 -> bbl/ft capacity constant: 1 bbl = 9702 in^3; capacity(bbl/ft) = ID^2 / 1029.4.
const CAPACITY_CONSTANT = 1029.4;

export function computeHydraulics(i: HydraulicsInputs): HydraulicsResult {
  const warnings: string[] = [];

  const annClearanceSq = i.holeDiameterIn ** 2 - i.pipeOdIn ** 2;
  let annularCapacityBblPerFt = 0;
  if (annClearanceSq <= 0) {
    warnings.push('Hole diameter must exceed pipe OD for a valid annulus.');
  } else {
    annularCapacityBblPerFt = annClearanceSq / CAPACITY_CONSTANT;
  }

  const pipeCapacityBblPerFt = i.pipeIdIn ** 2 / CAPACITY_CONSTANT;
  const annularVolumeBbl = annularCapacityBblPerFt * i.measuredDepthFt;

  const eff = i.pumpEfficiencyPct / 100;
  const pumpOutputBblPerStk = PUMP_TRIPLEX_FACTOR * i.pumpLinerIdIn ** 2 * i.pumpStrokeLengthIn * eff;
  if (pumpOutputBblPerStk <= 0) {
    warnings.push('Pump output is zero — check liner ID, stroke length, and efficiency.');
  }
  const flowRateGpm = pumpOutputBblPerStk * 42 * i.spm;

  let bottomsUpStrokes = 0;
  if (pumpOutputBblPerStk > 0) {
    bottomsUpStrokes = annularVolumeBbl / pumpOutputBblPerStk;
  }
  let bottomsUpTimeMin = 0;
  if (i.spm > 0) {
    bottomsUpTimeMin = bottomsUpStrokes / i.spm;
  } else if (bottomsUpStrokes > 0) {
    warnings.push('SPM is zero — bottoms-up time is undefined.');
  }

  let annularVelocityFtPerMin = 0;
  if (annClearanceSq > 0) {
    annularVelocityFtPerMin = (24.5 * flowRateGpm) / annClearanceSq;
  }

  const hydrostaticPressurePsi = 0.052 * i.mudWeightPpg * i.trueVerticalDepthFt;

  return {
    annularCapacityBblPerFt,
    pipeCapacityBblPerFt,
    annularVolumeBbl,
    pumpOutputBblPerStk,
    flowRateGpm,
    bottomsUpStrokes,
    bottomsUpTimeMin,
    annularVelocityFtPerMin,
    hydrostaticPressurePsi,
    warnings,
  };
}

// --- Registry: drives the panel (mirrors the field_defs pattern) ---

export interface HydraulicsFieldSpec {
  key: keyof HydraulicsInputs;
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  group: 'Geometry' | 'Depth' | 'Fluid' | 'Pump';
}

export const HYDRAULICS_FIELDS: HydraulicsFieldSpec[] = [
  { key: 'holeDiameterIn', label: 'Hole diameter', unit: 'in', min: 3, max: 36, default: 9.875, group: 'Geometry' },
  { key: 'pipeOdIn', label: 'Pipe OD', unit: 'in', min: 1, max: 10, default: 5.0, group: 'Geometry' },
  { key: 'pipeIdIn', label: 'Pipe ID', unit: 'in', min: 0.5, max: 9, default: 4.276, group: 'Geometry' },
  { key: 'measuredDepthFt', label: 'Measured depth (MD)', unit: 'ft', min: 0, max: 40000, default: 4400, group: 'Depth' },
  { key: 'trueVerticalDepthFt', label: 'True vertical depth (TVD)', unit: 'ft', min: 0, max: 40000, default: 4400, group: 'Depth' },
  { key: 'mudWeightPpg', label: 'Mud weight', unit: 'ppg', min: 7, max: 20, default: 12.4, group: 'Fluid' },
  { key: 'pumpLinerIdIn', label: 'Pump liner ID', unit: 'in', min: 3, max: 8, default: 6.25, group: 'Pump' },
  { key: 'pumpStrokeLengthIn', label: 'Pump stroke length', unit: 'in', min: 6, max: 18, default: 12, group: 'Pump' },
  { key: 'pumpEfficiencyPct', label: 'Pump efficiency', unit: '%', min: 50, max: 100, default: 95, group: 'Pump' },
  { key: 'spm', label: 'Pump speed', unit: 'spm', min: 0, max: 200, default: 60, group: 'Pump' },
];

export interface HydraulicsOutputSpec {
  key: keyof Omit<HydraulicsResult, 'warnings'>;
  label: string;
  unit: string;
  decimals: number;
}

export const HYDRAULICS_OUTPUTS: HydraulicsOutputSpec[] = [
  { key: 'annularCapacityBblPerFt', label: 'Annular capacity', unit: 'bbl/ft', decimals: 4 },
  { key: 'pipeCapacityBblPerFt', label: 'Pipe capacity', unit: 'bbl/ft', decimals: 4 },
  { key: 'annularVolumeBbl', label: 'Annular volume', unit: 'bbl', decimals: 1 },
  { key: 'pumpOutputBblPerStk', label: 'Pump output', unit: 'bbl/stk', decimals: 4 },
  { key: 'flowRateGpm', label: 'Flow rate', unit: 'gpm', decimals: 1 },
  { key: 'bottomsUpStrokes', label: 'Bottoms-up', unit: 'strokes', decimals: 0 },
  { key: 'bottomsUpTimeMin', label: 'Bottoms-up time', unit: 'min', decimals: 1 },
  { key: 'annularVelocityFtPerMin', label: 'Annular velocity', unit: 'ft/min', decimals: 1 },
  { key: 'hydrostaticPressurePsi', label: 'Hydrostatic pressure', unit: 'psi', decimals: 0 },
];
