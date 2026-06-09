import { describe, it, expect } from 'vitest';
import { assembleTicket, summarizeTicket, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID } from '../src/coded-object/graph';

describe('summarizeTicket', () => {
  it('summarizes the seed ticket', () => {
    const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
    const s = summarizeTicket(view);
    expect(s.id).toBe(SEED_TICKET_ID);
    expect(s.label).toBe('12¼" Intermediate');
    expect(s.code).toBe('DRL');
    expect(s.bankLabel).toBe('Drilling');
    expect(s.category).toBe('Make Hole');
    expect(s.status).toBe('in_progress');
    expect(s.parties).toBe(2);
    expect(s.equipment).toBe(2);
    expect(s.bha).toBe(1);
    expect(s.timelineCount).toBe(4);
    expect(s.latestActivity?.code).toBe('RIGREP');
    expect(s.latestActivity?.atMin).toBe(510);
    expect(s.latestActivity?.bankLabel).toBe('Rig Repair');
    expect(s.warningCount).toBe(0);
  });

  it('tolerates an unknown section code (no bankLabel) and missing status', () => {
    const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
    const s = summarizeTicket({ ...view, section: { ...view.section, code: 'ZZZ', fields: {} } });
    expect(s.code).toBe('ZZZ');
    expect(s.bankLabel).toBeUndefined();
    expect(s.status).toBeUndefined();
  });

  it('treats an empty-string status as undefined', () => {
    const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
    const s = summarizeTicket({ ...view, section: { ...view.section, fields: { status: '' } } });
    expect(s.status).toBeUndefined();
  });

  it('handles a timeline with no activity events (no latestActivity)', () => {
    const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
    const s = summarizeTicket({ ...view, timeline: view.timeline.filter((e) => e.kind !== 'activity') });
    expect(s.latestActivity).toBeUndefined();
  });
});
