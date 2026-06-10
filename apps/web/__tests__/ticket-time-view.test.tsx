import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SEED_TICKET_ID } from '@valor/core';
import { TicketTimeView } from '@/components/ticket-time-view';

describe('TicketTimeView', () => {
  it('renders the seed ticket label after loading', async () => {
    const { findByText } = render(<TicketTimeView ticketId={SEED_TICKET_ID} />);
    expect(await findByText(/12¼" Intermediate/)).toBeTruthy();
  });

  it('offers "Log activity" once a ticket loads', async () => {
    const { findByText, getByRole } = render(<TicketTimeView ticketId={SEED_TICKET_ID} />);
    await findByText(/12¼" Intermediate/);
    expect(getByRole('button', { name: /log activity/i })).toBeTruthy();
  });

  it('shows a not-found state (and no "Log activity") for an unknown ticket', async () => {
    const { findByText, queryByRole } = render(<TicketTimeView ticketId="does-not-exist" />);
    expect(await findByText(/not found/i)).toBeTruthy();
    expect(queryByRole('button', { name: /log activity/i })).toBeNull();
  });

  it('offers "Sign handoff" once a ticket loads', async () => {
    const { findByText, getByRole } = render(<TicketTimeView ticketId={SEED_TICKET_ID} />);
    await findByText(/12¼" Intermediate/);
    expect(getByRole('button', { name: /sign handoff/i })).toBeTruthy();
  });

  it('does not re-open the handoff drawer after navigating away and back', async () => {
    const { rerender, findByText, getByRole, queryByTestId } = render(<TicketTimeView ticketId={SEED_TICKET_ID} />);
    await findByText(/12¼" Intermediate/);
    fireEvent.click(getByRole('button', { name: /sign handoff/i }));
    expect(queryByTestId('handoff-drawer')).toBeTruthy(); // drawer is open on this ticket
    rerender(<TicketTimeView ticketId="does-not-exist" />);
    await findByText(/not found/i);
    rerender(<TicketTimeView ticketId={SEED_TICKET_ID} />);
    await findByText(/12¼" Intermediate/);
    expect(queryByTestId('handoff-drawer')).toBeNull(); // stays closed — handoffOpen was reset
  });
});
