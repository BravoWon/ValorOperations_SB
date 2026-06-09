import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { deriveTimeAccounting, type RigDay, type Notification } from '@valor/core';
import { OperatorsDayBoard, type DayBoardEntry } from '@/components/operators-day-board';

// DRL is productive; RIGREP is NPT (both in BANK_SEED).
const dayA: RigDay = { id: 's1', label: 'Section A', blocks: [{ id: 'a1', code: 'DRL', startMin: 0, endMin: 120 }] };
const dayB: RigDay = { id: 's2', label: 'Section B', blocks: [{ id: 'b1', code: 'RIGREP', startMin: 0, endMin: 60 }] };
const note: Notification = { id: 'n1', severity: 'warn', category: 'gap', title: 'Unaccounted 0:45 gap', detail: '01:00–01:45' };

const entries: DayBoardEntry[] = [
  { day: dayA, accounting: deriveTimeAccounting(dayA.blocks), notifications: [], sectionLabel: 'Section A', href: '/tickets/s1' },
  { day: dayB, accounting: deriveTimeAccounting(dayB.blocks), notifications: [note], sectionLabel: 'Section B', href: '/tickets/s2' },
];

describe('OperatorsDayBoard', () => {
  it('renders one row per entry', () => {
    const { getAllByTestId } = render(<OperatorsDayBoard rows={entries} />);
    expect(getAllByTestId('day-board-row').length).toBe(2);
  });

  it('shows aggregate KPIs summed per section (productive 02:00, NPT 01:00, 2 active)', () => {
    const { getByText } = render(<OperatorsDayBoard rows={entries} />);
    expect(getByText('02:00')).toBeTruthy();
    expect(getByText('01:00')).toBeTruthy();
    expect(getByText(/active sections/i)).toBeTruthy();
  });

  it('renders notifications tagged with their section', () => {
    const { getByText, getAllByTestId } = render(<OperatorsDayBoard rows={entries} />);
    expect(getByText(/Unaccounted 0:45 gap/)).toBeTruthy();
    const items = getAllByTestId('day-notification');
    expect(items.length).toBe(1);
    expect(items[0]!.textContent).toMatch(/Section B/);
  });
});
