import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { assembleTicket, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID } from '@valor/core';
import { HandoffDrawer } from '@/components/handoff-drawer';

const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;

describe('HandoffDrawer', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(<HandoffDrawer open={false} view={view} onSign={() => {}} onClose={() => {}} />);
    expect(queryByTestId('handoff-drawer')).toBeNull();
  });

  it('derives the summary at the default cutoff (the latest logged event)', () => {
    // The seed's latest event is the QC at 600, so the default cutoff is 600 — the open
    // RIGREP block (last activity, projected to end-of-day) is mid-span and carries forward.
    const { getByTestId, getByText, getByLabelText } = render(<HandoffDrawer open view={view} onSign={() => {}} onClose={() => {}} />);
    expect(getByTestId('handoff-drawer')).toBeTruthy();
    expect((getByLabelText(/cutoff/i) as HTMLInputElement).value).toBe('600');
    expect(getByText(/TIH/)).toBeTruthy();
    expect(getByText(/carries forward/i)).toBeTruthy(); // RIGREP spans 600
  });

  it('re-derives when the cutoff changes (carry-forward resolves on a boundary)', () => {
    const { getByLabelText, getByText } = render(<HandoffDrawer open view={view} onSign={() => {}} onClose={() => {}} />);
    fireEvent.change(getByLabelText(/cutoff/i), { target: { value: '1440' } });
    expect(getByText(/no carry-forward/i)).toBeTruthy(); // every block ends by 1440
  });

  it('defaults the cutoff to the latest event even when that is minute 0 (no || fallback)', () => {
    const atZero = { ...view, timeline: [DEFAULT_TIMELINE[0]!] }; // single activity at atMin 0
    const { getByLabelText, getByText } = render(<HandoffDrawer open view={atZero} onSign={() => {}} onClose={() => {}} />);
    expect((getByLabelText(/cutoff/i) as HTMLInputElement).value).toBe('0');
    expect(getByText(/no completed work/i)).toBeTruthy(); // nothing finished before minute 0
  });

  it('resets cutoff and narrative on each reopen (parent keeps it mounted)', () => {
    const { rerender, getByLabelText } = render(<HandoffDrawer open view={view} onSign={() => {}} onClose={() => {}} />);
    fireEvent.change(getByLabelText(/cutoff/i), { target: { value: '300' } });
    fireEvent.change(getByLabelText(/narrative/i), { target: { value: 'stale note' } });
    rerender(<HandoffDrawer open={false} view={view} onSign={() => {}} onClose={() => {}} />);
    rerender(<HandoffDrawer open view={view} onSign={() => {}} onClose={() => {}} />);
    expect((getByLabelText(/cutoff/i) as HTMLInputElement).value).toBe('600'); // back to the default
    expect((getByLabelText(/narrative/i) as HTMLTextAreaElement).value).toBe(''); // cleared
  });

  it('signing passes the cutoff and narrative to onSign', () => {
    const onSign = vi.fn();
    const { getByLabelText, getByText } = render(<HandoffDrawer open view={view} onSign={onSign} onClose={() => {}} />);
    fireEvent.change(getByLabelText(/cutoff/i), { target: { value: '720' } });
    fireEvent.change(getByLabelText(/narrative/i), { target: { value: 'Watch the pumps.' } });
    fireEvent.click(getByText(/^Sign handoff$/i));
    expect(onSign).toHaveBeenCalledWith(720, 'Watch the pumps.');
  });
});
