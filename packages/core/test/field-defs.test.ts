import { describe, it, expect } from 'vitest';
import { HEADER_FIELDS, CASING_COLUMNS, DEFAULT_WELL_SETUP } from '../src/well-setup/field-defs';
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
