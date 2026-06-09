import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SEED_TICKET_ID } from '@valor/core';
import { TicketTimeView } from '@/components/ticket-time-view';

describe('TicketTimeView', () => {
  it('renders the seed ticket label after loading', async () => {
    const { findByText } = render(<TicketTimeView ticketId={SEED_TICKET_ID} />);
    expect(await findByText(/12¼" Intermediate/)).toBeTruthy();
  });

  it('shows a not-found state for an unknown ticket', async () => {
    const { findByText } = render(<TicketTimeView ticketId="does-not-exist" />);
    expect(await findByText(/not found/i)).toBeTruthy();
  });
});
