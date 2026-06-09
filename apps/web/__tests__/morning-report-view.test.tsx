import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { assembleTicket, deriveMorningReport, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID } from '@valor/core';
import { MorningReportView } from '@/components/morning-report-view';

const section = deriveMorningReport(assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!);

describe('MorningReportView', () => {
  it('renders the section header, accounting line, and code tally', () => {
    const { getByText, getAllByTestId, getAllByText } = render(<MorningReportView sections={[section]} />);
    expect(getByText('12¼" Intermediate')).toBeTruthy();
    // productive total "08:30" appears only in the accounting line (TIH=02:00, DRL=06:30)
    expect(getByText(/08:30/)).toBeTruthy();
    // "15:30" appears at minimum once (NPT total; also in RIGREP tally row — use length check)
    expect(getAllByText(/15:30/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByTestId('report-tally-row').length).toBe(3);
  });

  it('renders crews and an all-clear journal note when empty', () => {
    const { getByText } = render(<MorningReportView sections={[section]} />);
    expect(getByText(/Directional Driller/)).toBeTruthy();
    expect(getByText(/no journal entries/i)).toBeTruthy();
  });

  it('renders one report section per entry', () => {
    const { getAllByTestId } = render(<MorningReportView sections={[section, { ...section, ticketId: 's2', sectionLabel: 'Section Two' }]} />);
    expect(getAllByTestId('report-section').length).toBe(2);
  });
});
