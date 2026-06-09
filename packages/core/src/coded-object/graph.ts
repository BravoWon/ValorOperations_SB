import { findBankCode } from '../well-setup/bank';
import type {
  CodedGraph, CodedObject, ObjectType, RelationKind, TimelineEvent, TicketView,
} from './types';

export * from './types';
export { DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID } from './seed';

export function objectsByType(graph: CodedGraph, type: ObjectType): CodedObject[] {
  return graph.objects.filter((o) => o.type === type);
}

/** Objects linked from `fromId` (optionally by kind). Dangling targets are skipped. */
export function relatedObjects(graph: CodedGraph, fromId: string, kind?: RelationKind): CodedObject[] {
  const byId = new Map(graph.objects.map((o) => [o.id, o]));
  return graph.relations
    .filter((r) => r.fromId === fromId && (kind === undefined || r.kind === kind))
    .map((r) => byId.get(r.toId))
    .filter((o): o is CodedObject => o !== undefined);
}

/** Next monotonic seq for a ticket: max existing + 1 (1 when none). */
export function nextSeq(events: TimelineEvent[], ticketId: string): number {
  const seqs = events.filter((e) => e.ticketId === ticketId).map((e) => e.seq);
  return seqs.length === 0 ? 1 : Math.max(...seqs) + 1;
}

/** Assemble a Ticket (a section CodedObject) + its related objects + timeline. Null if not a section. */
export function assembleTicket(graph: CodedGraph, events: TimelineEvent[], ticketId: string): TicketView | null {
  const section = graph.objects.find((o) => o.id === ticketId && o.type === 'section');
  if (!section) return null;

  const warnings: string[] = [];
  const byId = new Map(graph.objects.map((o) => [o.id, o]));
  const outgoing = graph.relations.filter((r) => r.fromId === ticketId);

  // Dangling-relation detection: exactly one warning per outgoing relation whose target is missing.
  for (const r of outgoing) {
    if (!byId.has(r.toId)) {
      warnings.push(`Relation ${r.id} (${r.kind}) points to missing object ${r.toId}.`);
    }
  }

  // Resolve a bucket by relation kind + target type. `uses` is polymorphic (equipment + bha);
  // a target of the wrong type for this bucket is filtered out silently (not an error).
  const resolve = (kind: RelationKind, type: ObjectType): CodedObject[] =>
    outgoing
      .filter((r) => r.kind === kind)
      .map((r) => byId.get(r.toId))
      .filter((o): o is CodedObject => o !== undefined && o.type === type);

  const parties = resolve('assigned', 'party');
  const equipment = resolve('uses', 'equipment');
  const bha = resolve('uses', 'bha');

  const timeline = events.filter((e) => e.ticketId === ticketId).sort((a, b) => a.seq - b.seq);
  for (let i = 1; i < timeline.length; i++) {
    if (timeline[i]!.seq === timeline[i - 1]!.seq) warnings.push(`Duplicate timeline seq ${timeline[i]!.seq}.`);
  }
  for (const e of timeline) {
    if (e.kind === 'activity' && e.code && !findBankCode(e.code)) {
      warnings.push(`Timeline event references unknown Bank code "${e.code}".`);
    }
  }
  if (section.code && !findBankCode(section.code)) {
    warnings.push(`Section references unknown Bank code "${section.code}".`);
  }

  return { section, parties, equipment, bha, timeline, warnings };
}
