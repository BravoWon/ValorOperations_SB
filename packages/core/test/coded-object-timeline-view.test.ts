import { describe, it, expect } from 'vitest';
import { assembleTicket, timelineToRigDay, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID } from '../src/coded-object/graph';

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
});
