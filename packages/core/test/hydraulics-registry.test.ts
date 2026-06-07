import { describe, it, expect } from 'vitest';
import {
  computeHydraulics,
  HYDRAULICS_FIELDS,
  HYDRAULICS_OUTPUTS,
  type HydraulicsInputs,
} from '../src/compute/hydraulics';

const INPUT_KEYS: (keyof HydraulicsInputs)[] = [
  'holeDiameterIn',
  'pipeOdIn',
  'pipeIdIn',
  'measuredDepthFt',
  'trueVerticalDepthFt',
  'mudWeightPpg',
  'pumpLinerIdIn',
  'pumpStrokeLengthIn',
  'pumpEfficiencyPct',
  'spm',
];

describe('HYDRAULICS registry integrity', () => {
  it('HYDRAULICS_FIELDS keys are unique and cover the HydraulicsInputs shape exactly', () => {
    const fieldKeys = HYDRAULICS_FIELDS.map((f) => f.key);
    // same length → no duplicates (combined with sorted equality below)
    expect(fieldKeys.length).toBe(INPUT_KEYS.length);
    expect([...fieldKeys].sort()).toEqual([...INPUT_KEYS].sort());
    // explicit uniqueness check
    const unique = new Set(fieldKeys);
    expect(unique.size).toBe(fieldKeys.length);
  });

  it('HYDRAULICS_OUTPUTS keys are unique and exist on a computed result', () => {
    const defaults = Object.fromEntries(
      HYDRAULICS_FIELDS.map((f) => [f.key, f.default]),
    ) as unknown as HydraulicsInputs;
    const result = computeHydraulics(defaults);

    expect(HYDRAULICS_OUTPUTS.length).toBe(9);

    const outputKeys = HYDRAULICS_OUTPUTS.map((s) => s.key);
    // uniqueness
    expect(new Set(outputKeys).size).toBe(outputKeys.length);

    for (const key of outputKeys) {
      // key exists on the result object
      expect(key in result).toBe(true);
      // 'warnings' must not appear
      expect(key).not.toBe('warnings');
    }
  });

  it('every field default is within its [min, max]', () => {
    for (const f of HYDRAULICS_FIELDS) {
      expect(f.default).toBeGreaterThanOrEqual(f.min);
      expect(f.default).toBeLessThanOrEqual(f.max);
    }
  });

  it('defaults produce no warnings', () => {
    const defaults = Object.fromEntries(
      HYDRAULICS_FIELDS.map((f) => [f.key, f.default]),
    ) as unknown as HydraulicsInputs;
    const { warnings } = computeHydraulics(defaults);
    expect(warnings).toEqual([]);
  });
});
