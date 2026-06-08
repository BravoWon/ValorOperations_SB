import { describe, it, expect } from 'vitest';
import { projectWellbore } from '../src/well-setup/project-wellbore';
import { DEFAULT_WELL_SETUP } from '../src/well-setup/field-defs';

describe('projectWellbore', () => {
  it('sorts casings outer→inner by OD', () => {
    const m = projectWellbore(DEFAULT_WELL_SETUP);
    const ods = m.casings.map((c) => c.odIn);
    expect(ods).toEqual([...ods].sort((a, b) => b - a));
  });
  it('totalDepth = deepest shoe/hole bottom', () => {
    const m = projectWellbore(DEFAULT_WELL_SETUP);
    expect(m.totalDepthFt).toBe(6400);
  });
  it('resolves the code label from the Bank', () => {
    const m = projectWellbore(DEFAULT_WELL_SETUP);
    expect(m.header.codeLabel).toBe('Drilling');
  });
  it('warns when a casing shoe is deeper than total hole', () => {
    const bad = structuredClone(DEFAULT_WELL_SETUP);
    bad.casings[2]!.shoeMdFt = 9999;
    expect(projectWellbore(bad).warnings.some((w) => /shoe/i.test(w))).toBe(true);
  });
  it('warns on unknown code', () => {
    const bad = structuredClone(DEFAULT_WELL_SETUP);
    bad.header.jobCode = 'ZZZ';
    expect(projectWellbore(bad).warnings.some((w) => /code/i.test(w))).toBe(true);
  });
});
