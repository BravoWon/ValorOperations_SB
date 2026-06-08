import { describe, it, expect } from 'vitest';
import { BANK_SEED, findBankCode, listBankByCategory } from '../src/well-setup/bank';

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
});
