import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { assembleTicket, type CodedObject, type Relation, type TimelineEvent } from '../src/coded-object/graph';

const ORG = 'org-valor';
const section: CodedObject = { id: 's1', orgId: ORG, type: 'section', code: 'DRL', fields: { status: 'in_progress' } };
const party: CodedObject = { id: 'p1', orgId: ORG, type: 'party', code: 'DD', fields: {} };
const rel: Relation = { id: 'r1', orgId: ORG, fromId: 's1', toId: 'p1', kind: 'assigned' };

describe('MockRepository coded-object graph', () => {
  it('round-trips objects + relations into a graph', async () => {
    const repo = new MockRepository();
    await repo.saveCodedObject(section);
    await repo.saveCodedObject(party);
    await repo.saveRelation(rel);
    const graph = await repo.loadCodedGraph(ORG);
    expect(graph.objects.map((o) => o.id).sort()).toEqual(['p1', 's1']);
    expect(graph.relations.map((r) => r.id)).toEqual(['r1']);
    const view = assembleTicket(graph, [], 's1')!;
    expect(view.parties.map((o) => o.id)).toEqual(['p1']);
  });

  it('saveCodedObject upserts by id (no duplicates)', async () => {
    const repo = new MockRepository();
    await repo.saveCodedObject(section);
    await repo.saveCodedObject({ ...section, label: 'renamed' });
    const objs = await repo.loadCodedObjects(ORG);
    expect(objs.length).toBe(1);
    expect(objs[0]!.label).toBe('renamed');
  });

  it('loadCodedObjects filters by type', async () => {
    const repo = new MockRepository();
    await repo.saveCodedObject(section);
    await repo.saveCodedObject(party);
    expect((await repo.loadCodedObjects(ORG, 'party')).map((o) => o.id)).toEqual(['p1']);
  });

  it('appendTimelineEvent assigns increasing seq and is append-only', async () => {
    const repo = new MockRepository();
    const base = { orgId: ORG, ticketId: 's1', atMin: 0, kind: 'activity' as const };
    const a = await repo.appendTimelineEvent({ id: 'e1', ...base, code: 'TIH' });
    const b = await repo.appendTimelineEvent({ id: 'e2', ...base, code: 'DRL' });
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
    const timeline = await repo.loadTimeline('s1');
    expect(timeline.map((e) => e.id)).toEqual(['e1', 'e2']); // first not dropped
  });

  it('appendTimelineEvent respects a caller-supplied seq', async () => {
    // Caller-supplied seq is taken verbatim; duplicate seq is surfaced as a warning by
    // assembleTicket, not prevented here (append-only log; corrections are new events).
    const repo = new MockRepository();
    const e = await repo.appendTimelineEvent({ id: 'e9', orgId: ORG, ticketId: 's1', seq: 42, atMin: 5, kind: 'note' });
    expect(e.seq).toBe(42);
  });

  it('loadCodedGraph isolates by org', async () => {
    const repo = new MockRepository();
    await repo.saveCodedObject(section); // org-valor
    await repo.saveCodedObject({ id: 's2', orgId: 'org-other', type: 'section', fields: {} });
    await repo.saveRelation(rel); // org-valor
    await repo.saveRelation({ id: 'r2', orgId: 'org-other', fromId: 's2', toId: 'p1', kind: 'uses' });
    const graph = await repo.loadCodedGraph(ORG);
    expect(graph.objects.map((o) => o.id)).toEqual(['s1']);
    expect(graph.relations.map((r) => r.id)).toEqual(['r1']);
  });
});
