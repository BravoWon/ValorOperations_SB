import { describe, it, expect } from 'vitest';
import { computeHydraulics, type HydraulicsInputs, HYDRAULICS_OUTPUTS } from '../src/compute/hydraulics';

const BASE: HydraulicsInputs = {
  holeDiameterIn: 9.875,
  pipeOdIn: 5.0,
  pipeIdIn: 4.276,
  measuredDepthFt: 4400,
  trueVerticalDepthFt: 4400,
  mudWeightPpg: 12.4,
  pumpLinerIdIn: 6.25,
  pumpStrokeLengthIn: 12,
  pumpEfficiencyPct: 95,
  spm: 60,
};

describe('computeHydraulics', () => {
  it('computes capacities, volumes, pump output, and pressures', () => {
    const r = computeHydraulics(BASE);
    expect(r.annularCapacityBblPerFt).toBeCloseTo(0.07044, 4);
    expect(r.pipeCapacityBblPerFt).toBeCloseTo(0.0178, 4);
    expect(r.annularVolumeBbl).toBeCloseTo(309.96, 1);
    expect(r.pumpOutputBblPerStk).toBeCloseTo(0.1082, 4);
    expect(r.flowRateGpm).toBeCloseTo(272.69, 1);
    expect(r.bottomsUpStrokes).toBeCloseTo(2864.4, 0);
    expect(r.bottomsUpTimeMin).toBeCloseTo(47.73, 1);
    expect(r.annularVelocityFtPerMin).toBeCloseTo(92.13, 1);
    expect(r.hydrostaticPressurePsi).toBeCloseTo(2837.12, 1);
    expect(r.warnings).toEqual([]);
  });

  it('warns and zeroes annular figures when hole does not exceed pipe OD', () => {
    const r = computeHydraulics({ ...BASE, holeDiameterIn: 5.0 });
    expect(r.annularCapacityBblPerFt).toBe(0);
    expect(r.annularVolumeBbl).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/exceed pipe OD/i);
  });

  it('warns when SPM is zero (bottoms-up time undefined)', () => {
    const r = computeHydraulics({ ...BASE, spm: 0 });
    expect(r.flowRateGpm).toBe(0);
    expect(r.bottomsUpTimeMin).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/SPM is zero/i);
  });

  it('warns and zeroes pump-derived figures when pump efficiency is zero', () => {
    const r = computeHydraulics({ ...BASE, pumpEfficiencyPct: 0 });
    expect(r.pumpOutputBblPerStk).toBe(0);
    expect(r.flowRateGpm).toBe(0);
    expect(r.bottomsUpStrokes).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/Pump output is zero/i);
  });

  // --- test-after-resolution: robustness suite ---

  it('zeroes pipe capacity and warns on negative pipe ID', () => {
    const r = computeHydraulics({ ...BASE, pipeIdIn: -4 });
    expect(r.pipeCapacityBblPerFt).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/pipe id/i);
  });

  it('zeroes hydrostatic and warns on negative mud weight', () => {
    const r = computeHydraulics({ ...BASE, mudWeightPpg: -5 });
    expect(r.hydrostaticPressurePsi).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/mud weight/i);
  });

  it('produces only finite outputs and warns on non-finite input', () => {
    const r = computeHydraulics({ ...BASE, holeDiameterIn: NaN });
    const numericKeys = HYDRAULICS_OUTPUTS.map((s) => s.key);
    for (const key of numericKeys) {
      expect(Number.isFinite(r[key])).toBe(true);
    }
    expect(r.warnings.join(' ')).toMatch(/valid number/i);
  });

  it('adds a soft warning for out-of-range input but still computes', () => {
    const r = computeHydraulics({ ...BASE, spm: 500 });
    expect(r.warnings.join(' ')).toMatch(/above the expected maximum/i);
    expect(r.flowRateGpm).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(computeHydraulics(BASE)).toEqual(computeHydraulics(BASE));
  });

  it('zero MD yields zero annular volume but positive capacity', () => {
    const r = computeHydraulics({ ...BASE, measuredDepthFt: 0 });
    expect(r.annularVolumeBbl).toBe(0);
    expect(r.annularCapacityBblPerFt).toBeGreaterThan(0);
  });
});
