import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { deriveTimeAccounting, DEFAULT_RIG_DAY } from '@valor/core';
import { TimeAccountingRail } from '@/components/time-accounting-rail';

describe('TimeAccountingRail', () => {
  it('shows NPT and per-code tallies', () => {
    const acc = deriveTimeAccounting(DEFAULT_RIG_DAY.blocks);
    const { getByText, getAllByTestId } = render(<TimeAccountingRail accounting={acc} />);
    expect(getByText(/NPT/i)).toBeTruthy();
    expect(getAllByTestId('code-tally').length).toBe(acc.byCode.length);
  });
});
