import { describe, it, expect } from 'vitest';
import { DEFAULT_VENDORS, blankVendor, VENDOR_CATEGORIES } from '../src/office-ops/vendors';
import { DEFAULT_AFE, blankAfeLine, summarizeAfe } from '../src/office-ops/afe';

describe('office-ops', () => {
  it('vendor seed has unique ids + a known category', () => {
    expect(new Set(DEFAULT_VENDORS.map((v) => v.id)).size).toBe(DEFAULT_VENDORS.length);
    expect(VENDOR_CATEGORIES).toContain('Mud');
  });
  it('summarizeAfe totals budget/actual/variance', () => {
    const s = summarizeAfe([
      { id: 'a', code: '1', description: 'x', category: 'Drilling', budget: 100, actual: 120 },
      { id: 'b', code: '2', description: 'y', category: 'Mud', budget: 50, actual: 40 },
    ]);
    expect(s.totalBudget).toBe(150);
    expect(s.totalActual).toBe(160);
    expect(s.variance).toBe(-10);
    expect(s.byCategory.find((c) => c.category === 'Drilling')?.variance).toBe(-20);
  });
  it('summarizeAfe treats non-finite as 0', () => {
    const s = summarizeAfe([{ id: 'a', code: '1', description: 'x', category: 'Drilling', budget: NaN, actual: 10 }]);
    expect(s.totalBudget).toBe(0); expect(s.totalActual).toBe(10);
  });
  it('blanks are deterministic by seq', () => {
    expect(blankVendor(2).id).toBe('v-2'); expect(blankAfeLine(3).id).toBe('afe-3');
  });
});
