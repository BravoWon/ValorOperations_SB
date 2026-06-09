import { describe, it, expect } from 'vitest';
import { BANK_SEED, findBankCode, listBankByCategory, validateBankCodes } from '../src/well-setup/bank';

describe('Bank', () => {
  it('has unique codes', () => {
    const codes = BANK_SEED.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it('finds a code', () => { expect(findBankCode(BANK_SEED[0]!.code)?.label).toBeTruthy(); });
  it('flags NPT trouble activities', () => {
    expect(BANK_SEED.some((b) => b.npt)).toBe(true);
  });
  it('lists by category', () => {
    const cat = BANK_SEED[0]!.category;
    expect(listBankByCategory(cat).every((b) => b.category === cat)).toBe(true);
  });

  it('validateBankCodes: clean catalog yields no warnings', () => {
    expect(validateBankCodes(BANK_SEED)).toEqual([]);
  });

  it('validateBankCodes: flags an empty code', () => {
    const w = validateBankCodes([{ code: '  ', label: 'x', category: 'Make Hole', npt: false, billable: true }]);
    expect(w.some((m) => /code cannot be empty/i.test(m))).toBe(true);
  });

  it('validateBankCodes: flags an empty label, naming the code', () => {
    const w = validateBankCodes([{ code: 'DRL', label: '   ', category: 'Make Hole', npt: false, billable: true }]);
    expect(w.some((m) => /DRL: label cannot be empty/i.test(m))).toBe(true);
  });

  it('validateBankCodes: flags duplicate codes case-insensitively with a count', () => {
    const w = validateBankCodes([
      { code: 'DRL', label: 'Drilling', category: 'Make Hole', npt: false, billable: true },
      { code: 'drl', label: 'Drilling 2', category: 'Make Hole', npt: false, billable: true },
    ]);
    expect(w.some((m) => /Duplicate code "DRL" \(2×\)/.test(m))).toBe(true);
  });

  it('validateBankCodes: counts three occurrences of a duplicate', () => {
    const w = validateBankCodes([
      { code: 'DRL', label: 'a', category: 'Make Hole', npt: false, billable: true },
      { code: 'drl', label: 'b', category: 'Make Hole', npt: false, billable: true },
      { code: 'Drl', label: 'c', category: 'Make Hole', npt: false, billable: true },
    ]);
    expect(w.some((m) => /Duplicate code "DRL" \(3×\)/.test(m))).toBe(true);
  });
});
