import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PARTY_ROLES, type LaneItem } from '@valor/core';
import { LaneEditors } from '@/components/lane-editors';

describe('LaneEditors', () => {
  it('adds an item from the catalog', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <LaneEditors title="People" items={[]} catalog={PARTY_ROLES} onChange={onChange} idPrefix="p" />,
    );
    fireEvent.click(getByRole('button', { name: /add/i }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0] as LaneItem[];
    expect(next.length).toBe(1);
    expect(next[0]!.code).toBe(PARTY_ROLES[0]!.code);
    expect(next[0]!.id).toBe('p-1');
  });

  it('appends after the last item snapped to a 5-min span', () => {
    const onChange = vi.fn();
    const items: LaneItem[] = [
      { id: 'p-1', code: 'DD', label: 'DD', startMin: 0, endMin: 123 },
    ];
    const { getByRole } = render(
      <LaneEditors title="People" items={items} catalog={PARTY_ROLES} onChange={onChange} idPrefix="p" />,
    );
    fireEvent.click(getByRole('button', { name: /add/i }));
    const next = onChange.mock.calls.at(-1)?.[0] as LaneItem[];
    expect(next.length).toBe(2);
    expect(next[1]!.id).toBe('p-2');
    expect(next[1]!.startMin).toBe(125); // 123 snapped to 5
    expect(next[1]!.endMin).toBe(185); // +60
  });

  it('snaps a start input to the nearest 5 on blur', () => {
    const onChange = vi.fn();
    const items: LaneItem[] = [
      { id: 'p-1', code: 'DD', label: 'DD', startMin: 0, endMin: 120 },
    ];
    const { getAllByLabelText } = render(
      <LaneEditors title="People" items={items} catalog={PARTY_ROLES} onChange={onChange} idPrefix="p" />,
    );
    const start = getAllByLabelText(/Start \(min\)/i)[0] as HTMLInputElement;
    fireEvent.change(start, { target: { value: '7' } });
    fireEvent.blur(start);
    const next = onChange.mock.calls.at(-1)?.[0] as LaneItem[];
    expect(next[0]!.startMin).toBe(5);
  });

  it('removes a row', () => {
    const onChange = vi.fn();
    const items: LaneItem[] = [
      { id: 'p-1', code: 'DD', label: 'DD', startMin: 0, endMin: 120 },
      { id: 'p-2', code: 'MWD', label: 'MWD', startMin: 0, endMin: 120 },
    ];
    const { getAllByRole } = render(
      <LaneEditors title="People" items={items} catalog={PARTY_ROLES} onChange={onChange} idPrefix="p" />,
    );
    fireEvent.click((getAllByRole('button', { name: /remove/i })[0] as HTMLElement));
    const next = onChange.mock.calls.at(-1)?.[0] as LaneItem[];
    expect(next.length).toBe(1);
    expect(next[0]!.id).toBe('p-2');
  });
});
