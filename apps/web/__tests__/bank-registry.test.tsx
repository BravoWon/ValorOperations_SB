import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BANK_SEED, BANK_CATEGORIES } from '@valor/core';
import { BankRegistry } from '@/components/bank-registry';

describe('BankRegistry', () => {
  it('edits a label via onChange', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.change(getAllByLabelText(/^Label$/i)[0] as HTMLInputElement, { target: { value: 'Drilling Ahead' } });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].label).toBe('Drilling Ahead');
  });

  it('upper-cases the code on input', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.change(getAllByLabelText(/^Code$/i)[0] as HTMLInputElement, { target: { value: 'abc' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].code).toBe('ABC');
  });

  it('toggles NPT via the checkbox', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.click(getAllByLabelText(/NPT/i)[0] as HTMLInputElement);
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].npt).toBe(!BANK_SEED[0]!.npt);
  });

  it('offers existing categories as datalist options', () => {
    const onChange = vi.fn();
    const { container } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    const options = container.querySelectorAll('datalist option');
    expect(options.length).toBe(BANK_CATEGORIES.length);
  });

  it('adds a blank row', () => {
    const onChange = vi.fn();
    const { getByText } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.click(getByText(/Add code/i));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.length).toBe(BANK_SEED.length + 1);
    expect(next.at(-1)).toEqual({ code: '', label: '', category: BANK_CATEGORIES[0] ?? '', npt: false, billable: false });
  });

  it('removes a row', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.click(getAllByLabelText(/Remove/i)[0] as HTMLElement);
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.length).toBe(BANK_SEED.length - 1);
    expect(next.some((c: { code: string }) => c.code === BANK_SEED[0]!.code)).toBe(false);
  });

  it('filters by search', () => {
    const onChange = vi.fn();
    const { getByLabelText, getAllByTestId } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.change(getByLabelText(/search/i), { target: { value: 'STUCK' } });
    expect(getAllByTestId('bank-code-row').length).toBe(1);
  });
});
