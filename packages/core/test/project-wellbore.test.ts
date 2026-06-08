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

  it('drops fully-blank rows (an unfilled "Add" row)', () => {
    const withBlank = structuredClone(DEFAULT_WELL_SETUP);
    withBlank.casings.push({ role: '', odIn: 0, idIn: 0, weightPpf: 0, grade: '', connection: '', shoeMdFt: 0, shoeTvdFt: 0, tocFt: 0 });
    withBlank.formations.push({ name: '', topFt: 0, bottomFt: 0 });
    const m = projectWellbore(withBlank);
    expect(m.casings).toHaveLength(DEFAULT_WELL_SETUP.casings.length);
    expect(m.formations).toHaveLength(DEFAULT_WELL_SETUP.formations.length);
  });
});
