import { describe, it, expect } from 'vitest';
import { assembleTicket, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID, type TimelineEvent } from '../src/coded-object/graph';
import { deriveHandoff } from '../src/report/shift-handoff';

const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
const ORG = DEFAULT_TIMELINE[0]!.orgId;

describe('deriveHandoff', () => {
  // Seed blocks: TIH 0–120, DRL 120–510, RIGREP 510–1440.
  it('truncates work at the cutoff and reports the spanning block as carry-forward', () => {
    const h = deriveHandoff(view, 600);
    expect(h.ticketId).toBe(SEED_TICKET_ID);
    expect(h.sectionLabel).toBe('12¼" Intermediate');
    expect(h.cutoffMin).toBe(600);
    // Completed work before 600: TIH 120 + DRL 390 + RIGREP truncated 510–600 = 90.
    const byCode = Object.fromEntries(h.completedWork.map((t) => [t.code, t.minutes]));
    expect(byCode.TIH).toBe(120);
    expect(byCode.DRL).toBe(390);
    expect(byCode.RIGREP).toBe(90);
    // RIGREP spans the cutoff → it's the carry-forward (original, untruncated).
    expect(h.carryForwardBlock?.code).toBe('RIGREP');
    expect(h.carryForwardBlock?.endMin).toBe(1440);
  });

  it('has no carry-forward when the cutoff falls on a block boundary', () => {
    const h = deriveHandoff(view, 510);
    expect(h.carryForwardBlock).toBeNull();
    const byCode = Object.fromEntries(h.completedWork.map((t) => [t.code, t.minutes]));
    expect(byCode.TIH).toBe(120);
    expect(byCode.DRL).toBe(390);
    expect(byCode.RIGREP).toBeUndefined();
  });

  it('collects pending flagged QC before the cutoff only', () => {
    const flagged: TimelineEvent[] = [
      ...DEFAULT_TIMELINE,
      { id: 'qA', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 5, atMin: 200, kind: 'qc', qc: { status: 'flagged', note: 'early flag' } },
      { id: 'qB', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 6, atMin: 900, kind: 'qc', qc: { status: 'flagged', note: 'late flag' } },
    ];
    const h = deriveHandoff({ ...view, timeline: flagged }, 600);
    expect(h.pendingQcFlags).toEqual([{ atMin: 200, note: 'early flag' }]);
  });

  it('warns on an out-of-range cutoff and clamps; tolerates an empty timeline', () => {
    const bad = deriveHandoff(view, 2000);
    expect(bad.cutoffMin).toBe(1440);
    expect(bad.warnings.some((w) => /cutoff/i.test(w))).toBe(true);
    const empty = deriveHandoff({ ...view, timeline: [] }, 600);
    expect(empty.completedWork).toEqual([]);
    expect(empty.carryForwardBlock).toBeNull();
  });
});
