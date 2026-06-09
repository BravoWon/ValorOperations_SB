import { describe, it, expect } from 'vitest';
import { assembleTicket, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID, type TimelineEvent } from '../src/coded-object/graph';
import { deriveMorningReport } from '../src/report/morning-report';

const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
const ORG = DEFAULT_TIMELINE[0]!.orgId;

describe('deriveMorningReport', () => {
  it('summarizes the seed ticket (identity, accounting, crews)', () => {
    const r = deriveMorningReport(view);
    expect(r.ticketId).toBe(SEED_TICKET_ID);
    expect(r.sectionLabel).toBe('12¼" Intermediate');
    expect(r.code).toBe('DRL');
    expect(r.bankLabel).toBe('Drilling');
    expect(r.status).toBe('in_progress');
    expect(r.accounting.productiveMin).toBe(510);
    expect(r.accounting.nptMin).toBe(930);
    expect(r.accounting.byCode.length).toBe(3);
    expect(r.parties).toEqual(['Directional Driller', 'Mud Engineer']);
    expect(r.equipment).toEqual(['Rig', 'Triplex Pumps']);
  });

  it('collects flagged QC (not approved) with time + note', () => {
    const flagged: TimelineEvent[] = [
      ...DEFAULT_TIMELINE,
      { id: 'q2', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 5, atMin: 700, kind: 'qc', qc: { status: 'flagged', note: 'Re-check depth' } },
    ];
    const r = deriveMorningReport({ ...view, timeline: flagged });
    expect(r.flaggedQc).toEqual([{ atMin: 700, note: 'Re-check depth' }]);
    const base = deriveMorningReport(view);
    expect(base.flaggedQc).toEqual([]);
  });

  it('surfaces note/hse/milestone events as the journal, in seq order', () => {
    const withJournal: TimelineEvent[] = [
      ...DEFAULT_TIMELINE,
      { id: 'j1', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 5, atMin: 650, kind: 'note', note: 'Standby for weather' },
      { id: 'j2', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 6, atMin: 660, kind: 'hse', note: 'Toolbox talk held' },
      { id: 'j3', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 7, atMin: 700, kind: 'milestone', note: 'Shift handoff @ 11:40' },
    ];
    const r = deriveMorningReport({ ...view, timeline: withJournal });
    expect(r.journal.map((j) => j.kind)).toEqual(['note', 'hse', 'milestone']);
    expect(r.journal[0]).toEqual({ atMin: 650, kind: 'note', note: 'Standby for weather' });
  });

  it('passes through notifications and merges warnings; tolerates an empty timeline', () => {
    const r = deriveMorningReport(view);
    expect(Array.isArray(r.notifications)).toBe(true);
    expect(Array.isArray(r.warnings)).toBe(true);
    const empty = deriveMorningReport({ ...view, timeline: [] });
    expect(empty.accounting.totalLoggedMin).toBe(0);
    expect(empty.journal).toEqual([]);
    expect(empty.flaggedQc).toEqual([]);
  });
});
