import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DEFAULT_RIG_DAY } from '@valor/core';
import { BankPalette } from '@/components/bank-palette';
import { RigDayEditors } from '@/components/rig-day-editors';

describe('BankPalette', () => {
  it('adds a coded block on click', () => {
    const onAdd = vi.fn();
    const { getByRole } = render(<BankPalette onAdd={onAdd} />);
    fireEvent.click(getByRole('button', { name: /Drilling/i }));
    expect(onAdd).toHaveBeenCalledWith('DRL');
  });

  it('filters the catalog by search term', () => {
    const onAdd = vi.fn();
    const { getByLabelText, queryByRole } = render(<BankPalette onAdd={onAdd} />);
    fireEvent.change(getByLabelText(/search/i), { target: { value: 'cement' } });
    // Cementing survives; Drilling is filtered out.
    expect(queryByRole('button', { name: /Cementing/i })).toBeTruthy();
    expect(queryByRole('button', { name: /Drilling/i })).toBeNull();
  });
});

describe('RigDayEditors', () => {
  it('snaps start to nearest 5 on blur and emits onChange', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <RigDayEditors day={DEFAULT_RIG_DAY} onChange={onChange} />,
    );
    const start = getAllByLabelText(/Start \(min\)/i)[0] as HTMLInputElement;
    fireEvent.change(start, { target: { value: '7' } });
    fireEvent.blur(start);
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.blocks[0].startMin).toBe(5);
  });

  it('removes a block', () => {
    const onChange = vi.fn();
    const { getAllByRole } = render(
      <RigDayEditors day={DEFAULT_RIG_DAY} onChange={onChange} />,
    );
    const removeButtons = getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.blocks.length).toBe(DEFAULT_RIG_DAY.blocks.length - 1);
  });
});
