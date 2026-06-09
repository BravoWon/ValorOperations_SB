import { describe, it, expect } from 'vitest';
import {
  objectsByType, relatedObjects, nextSeq, assembleTicket,
  DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID,
  type CodedGraph, type TimelineEvent,
} from '../src/coded-object/graph';

describe('graph helpers', () => {
  it('objectsByType filters by type', () => {
    expect(objectsByType(DEFAULT_CODED_GRAPH, 'party').length).toBe(2);
    expect(objectsByType(DEFAULT_CODED_GRAPH, 'section').length).toBe(1);
  });

  it('relatedObjects resolves edges and skips dangling targets', () => {
    const parties = relatedObjects(DEFAULT_CODED_GRAPH, SEED_TICKET_ID, 'assigned');
    expect(parties.map((o) => o.type)).toEqual(['party', 'party']);
    const graph: CodedGraph = {
      objects: DEFAULT_CODED_GRAPH.objects,
      relations: [...DEFAULT_CODED_GRAPH.relations, { id: 'r-x', orgId: 'org-valor', fromId: SEED_TICKET_ID, toId: 'ghost', kind: 'uses' }],
    };
    expect(relatedObjects(graph, SEED_TICKET_ID).some((o) => o.id === 'ghost')).toBe(false);
  });

  it('nextSeq returns max+1 (1 when none)', () => {
    expect(nextSeq([], SEED_TICKET_ID)).toBe(1);
    expect(nextSeq(DEFAULT_TIMELINE, SEED_TICKET_ID)).toBe(DEFAULT_TIMELINE.length + 1);
  });

  it('assembleTicket builds a full TicketView from the seed', () => {
    const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
    expect(view.section.type).toBe('section');
    expect(view.parties.length).toBe(2);
    expect(view.equipment.length).toBe(2);
    expect(view.bha.length).toBe(1);
    expect(view.timeline.map((e) => e.seq)).toEqual([...DEFAULT_TIMELINE].map((e) => e.seq).sort((a, b) => a - b));
    expect(view.warnings).toEqual([]);
  });

  it('assembleTicket returns null for a non-section / missing id', () => {
    expect(assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, 'nope')).toBeNull();
  });

  it('assembleTicket warns on a dangling relation and an unknown Bank code', () => {
    const graph: CodedGraph = {
      objects: DEFAULT_CODED_GRAPH.objects,
      relations: [...DEFAULT_CODED_GRAPH.relations, { id: 'r-d', orgId: 'org-valor', fromId: SEED_TICKET_ID, toId: 'ghost', kind: 'assigned' }],
    };
    const events: TimelineEvent[] = [
      { id: 'e-bad', orgId: 'org-valor', ticketId: SEED_TICKET_ID, seq: 99, atMin: 10, kind: 'activity', code: 'ZZZ' },
    ];
    const view = assembleTicket(graph, events, SEED_TICKET_ID)!;
    expect(view.warnings.some((w) => /missing object ghost/i.test(w))).toBe(true);
    expect(view.warnings.some((w) => /unknown Bank code "ZZZ"/i.test(w))).toBe(true);
  });
});
