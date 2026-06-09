import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BANK_SEED } from '@valor/core';
import { BankSearchPalette } from '@/components/bank-search-palette';

describe('BankSearchPalette', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(<BankSearchPalette open={false} onClose={() => {}} codes={BANK_SEED} />);
    expect(queryByTestId('bank-search-palette')).toBeNull();
  });
  it('renders a search input when open', () => {
    const { getByLabelText } = render(<BankSearchPalette open onClose={() => {}} codes={BANK_SEED} />);
    expect(getByLabelText(/search the bank/i)).toBeTruthy();
  });
  it('filters by code/label', () => {
    const { getByLabelText, getByText, queryByText } = render(<BankSearchPalette open onClose={() => {}} codes={BANK_SEED} />);
    fireEvent.change(getByLabelText(/search the bank/i), { target: { value: 'stuck' } });
    expect(getByText(/STUCK/)).toBeTruthy();
    expect(queryByText(/Tripping In/)).toBeNull();
  });
  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<BankSearchPalette open onClose={onClose} codes={BANK_SEED} />);
    fireEvent.keyDown(getByLabelText(/search the bank/i), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
  it('selecting a code calls onSelect with the BankCode', () => {
    const onSelect = vi.fn();
    const { getByText } = render(<BankSearchPalette open onClose={() => {}} onSelect={onSelect} codes={BANK_SEED} />);
    fireEvent.click(getByText(/DRL — Drilling/));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: 'DRL' }));
  });
});
