import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { TicketSummary } from '@valor/core';
import { TicketCard } from '@/components/ticket-card';

const base: TicketSummary = {
  id: 'sec-int-1', label: '12¼" Intermediate', code: 'DRL', bankLabel: 'Drilling', category: 'Make Hole',
  status: 'in_progress', parties: 2, equipment: 2, bha: 1, timelineCount: 4,
  latestActivity: { code: 'RIGREP', atMin: 510, bankLabel: 'Rig Repair' }, warningCount: 0,
};

describe('TicketCard', () => {
  it('renders the label, code and counts', () => {
    const { getByText, getByTestId } = render(<TicketCard summary={base} />);
    expect(getByTestId('ticket-card')).toBeTruthy();
    expect(getByText('12¼" Intermediate')).toBeTruthy();
    expect(getByText(/DRL/)).toBeTruthy();
    expect(getByText(/4 events/i)).toBeTruthy();
  });
  it('shows a warning indicator when warningCount > 0', () => {
    const { queryByLabelText, rerender } = render(<TicketCard summary={base} />);
    expect(queryByLabelText(/warning/i)).toBeNull();
    rerender(<TicketCard summary={{ ...base, warningCount: 2 }} />);
    expect(queryByLabelText(/warning/i)).toBeTruthy();
  });
  it('links to the ticket timeline detail', () => {
    const { getByRole } = render(<TicketCard summary={base} />);
    const link = getByRole('link', { name: /view timeline/i }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/tickets/sec-int-1');
  });
});
