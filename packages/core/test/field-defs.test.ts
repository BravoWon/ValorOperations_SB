import { describe, it, expect } from 'vitest';
import { HEADER_FIELDS, CASING_COLUMNS, DEFAULT_WELL_SETUP, COMPLETION_TYPES, TUBING_FIELDS, COMPLETION_COLUMNS, WELLHEAD_FIELDS } from '../src/well-setup/field-defs';
import { findBankCode } from '../src/well-setup/bank';

describe('well-setup field-defs', () => {
  it('header includes a code field bound to the Bank', () => {
    const codeField = HEADER_FIELDS.find((f) => f.kind === 'code');
    expect(codeField?.key).toBe('jobCode');
  });
  it('default setup uses a real Bank code', () => {
    expect(findBankCode(DEFAULT_WELL_SETUP.header.jobCode)).toBeTruthy();
  });
  it('default has ordered casing strings', () => {
    expect(DEFAULT_WELL_SETUP.casings.length).toBeGreaterThanOrEqual(2);
  });
  it('every casing column has a key+label', () => {
    expect(CASING_COLUMNS.every((c) => c.key && c.label)).toBe(true);
  });
});

describe('completion registries + seed', () => {
  it('completion types include perforation/packer/sssv', () => {
    const vals = COMPLETION_TYPES.map((t) => t.value);
    expect(vals).toEqual(expect.arrayContaining(['perforation', 'packer', 'sssv']));
  });
  it('tubing + completion + wellhead registries are non-empty', () => {
    expect(TUBING_FIELDS.length).toBeGreaterThan(3);
    expect(COMPLETION_COLUMNS.length).toBeGreaterThan(3);
    expect(WELLHEAD_FIELDS.length).toBeGreaterThan(2);
  });
  it('default seed has tubing, completions (incl. a perforation), and a wellhead', () => {
    expect(DEFAULT_WELL_SETUP.tubing).toBeTruthy();
    expect((DEFAULT_WELL_SETUP.completions ?? []).some((c) => c.type === 'perforation')).toBe(true);
    expect(DEFAULT_WELL_SETUP.wellhead).toBeTruthy();
  });
  it('production casing seed carries cement detail', () => {
    expect(DEFAULT_WELL_SETUP.casings.some((c) => Number.isFinite(c.cementSacks))).toBe(true);
  });
});
