import { describe, it, expect } from 'vitest';
import {
  assembleTicket,
  timelineToRigDay,
  DEFAULT_CODED_GRAPH,
  DEFAULT_TIMELINE,
  SEED_TICKET_ID,
  type TimelineEvent,
} from '../src/coded-object/graph';

const ORG = DEFAULT_TIMELINE[0]!.orgId;
const ev = (over: Partial<TimelineEvent> & { id: string; seq: number; atMin: number }): TimelineEvent => ({
  orgId: ORG,
  ticketId: SEED_TICKET_ID,
  kind: 'activity',
  ...over,
});

describe('timelineToRigDay', () => {
  const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;

  it('projects activity events into blocks that span to the next activity', () => {
    const day = timelineToRigDay(view);
    expect(day.blocks.map((b) => b.code)).toEqual(['TIH', 'DRL', 'RIGREP']);
    expect(day.blocks.map((b) => [b.startMin, b.endMin])).toEqual([[0, 120], [120, 510], [510, 1440]]);
    expect(day.blocks.map((b) => b.id)).toEqual(['ev-1', 'ev-2', 'ev-3']); // event id carried onto the block
  });

  it('attaches a qc event (status + note) to the block whose span covers it', () => {
    const day = timelineToRigDay(view);
    const rigrep = day.blocks.find((b) => b.code === 'RIGREP')!;
    expect(rigrep.qc?.status).toBe('approved');
    expect(rigrep.qc?.note).toBe('Tower QC complete');
  });

  it('carries the section id/label and full-day lanes from parties/equipment', () => {
    const day = timelineToRigDay(view);
    expect(day.id).toBe(SEED_TICKET_ID);
    expect(day.label).toBe('12¼" Intermediate');
    expect(day.people?.length).toBe(2);
    expect(day.equipment?.length).toBe(2);
    expect(day.people?.every((l) => l.startMin === 0 && l.endMin === 1440)).toBe(true);
  });

  it('is deterministic and tolerates an empty timeline', () => {
    const empty = timelineToRigDay({ ...view, timeline: [] });
    expect(empty.blocks).toEqual([]);
    expect(empty.id).toBe(SEED_TICKET_ID);
  });

  it('a qc at a zero-span block start attaches to the next covering block', () => {
    // Two activities share atMin 100 → the first projects to a zero-span [100,100) block.
    const timeline = [
      ev({ id: 'a', seq: 1, atMin: 100, code: 'TIH' }),
      ev({ id: 'b', seq: 2, atMin: 100, code: 'DRL' }),
      ev({ id: 'q', seq: 3, atMin: 100, kind: 'qc', qc: { status: 'flagged' } }),
    ];
    const day = timelineToRigDay({ ...view, timeline });
    expect(day.blocks.map((b) => [b.startMin, b.endMin])).toEqual([[100, 100], [100, 1440]]);
    expect(day.blocks[0]!.qc).toBeUndefined(); // zero-span block can't cover the minute
    expect(day.blocks[1]!.qc?.status).toBe('flagged');
  });

  it('the last qc covering a block wins (single QcMark per block)', () => {
    const timeline = [
      ev({ id: 'a', seq: 1, atMin: 0, code: 'DRL' }),
      ev({ id: 'q1', seq: 2, atMin: 10, kind: 'qc', qc: { status: 'approved', note: 'first' } }),
      ev({ id: 'q2', seq: 3, atMin: 20, kind: 'qc', qc: { status: 'flagged', note: 'second' } }),
    ];
    const day = timelineToRigDay({ ...view, timeline });
    expect(day.blocks[0]!.qc).toEqual({ status: 'flagged', note: 'second' });
  });

  it('a qc at exactly DAY_MINUTES has no covering block and is dropped', () => {
    const timeline = [
      ev({ id: 'a', seq: 1, atMin: 0, code: 'DRL' }),
      ev({ id: 'q', seq: 2, atMin: 1440, kind: 'qc', qc: { status: 'approved' } }),
    ];
    const day = timelineToRigDay({ ...view, timeline });
    expect(day.blocks[0]!.qc).toBeUndefined();
  });

  it('a codeless activity is skipped (no block) and does not shift spans', () => {
    const timeline = [
      ev({ id: 'a', seq: 1, atMin: 0, code: 'TIH' }),
      ev({ id: 'x', seq: 2, atMin: 60 }), // activity with no code → skipped
      ev({ id: 'b', seq: 3, atMin: 120, code: 'DRL' }),
    ];
    const day = timelineToRigDay({ ...view, timeline });
    expect(day.blocks.map((b) => b.code)).toEqual(['TIH', 'DRL']);
    expect(day.blocks.map((b) => [b.startMin, b.endMin])).toEqual([[0, 120], [120, 1440]]);
  });
});
