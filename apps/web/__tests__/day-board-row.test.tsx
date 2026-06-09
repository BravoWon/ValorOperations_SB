import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { RigDay } from '@valor/core';
import { DayBoardRow } from '@/components/day-board-row';

const day: RigDay = {
  id: 'sec-int-1',
  label: '12¼" Intermediate',
  blocks: [
    { id: 'b1', code: 'DRL', startMin: 0, endMin: 720 },
    { id: 'b2', code: 'RIGREP', startMin: 720, endMin: 1440 },
  ],
};

describe('DayBoardRow', () => {
  it('renders one positioned block per coded block', () => {
    const { getAllByTestId } = render(<DayBoardRow day={day} href="/tickets/sec-int-1" />);
    const blocks = getAllByTestId('day-board-block');
    expect(blocks.length).toBe(2);
    expect((blocks[0] as HTMLElement).style.left).toBe('0%');
    expect((blocks[0] as HTMLElement).style.width).toBe('50%');
  });

  it('links the whole row to the ticket time-view', () => {
    const { getByTestId } = render(<DayBoardRow day={day} href="/tickets/sec-int-1" />);
    const row = getByTestId('day-board-row') as HTMLAnchorElement;
    expect(row.getAttribute('href')).toBe('/tickets/sec-int-1');
    expect(row.getAttribute('aria-label')).toMatch(/12¼" Intermediate/);
  });

  it('shows the section label and block count in the gutter', () => {
    const { getByText } = render(<DayBoardRow day={day} href="/tickets/sec-int-1" />);
    expect(getByText('12¼" Intermediate')).toBeTruthy();
    expect(getByText(/2 blocks/i)).toBeTruthy();
  });

  it('uses the singular for a single block', () => {
    const single = { ...day, blocks: day.blocks.slice(0, 1) };
    const { getByText, queryByText } = render(<DayBoardRow day={single} href="/tickets/sec-int-1" />);
    expect(getByText(/1 block$/i)).toBeTruthy();
    expect(queryByText(/1 blocks/i)).toBeNull();
  });
});
