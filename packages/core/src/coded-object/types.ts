export type ObjectType = 'section' | 'party' | 'equipment' | 'bha' | 'well' | 'job' | (string & {});
export type FieldValue = string | number | boolean | null;

export interface CodedObject {
  id: string;
  orgId: string;
  type: ObjectType;
  code?: string;                       // FK into the Bank (or a type catalog)
  label?: string;
  fields: Record<string, FieldValue>;  // typed-EAV; validated vs TemplateFieldDef at the app layer
}

export type RelationKind = 'parent' | 'place' | 'assigned' | 'uses' | (string & {});
export interface Relation {
  id: string;
  orgId: string;
  fromId: string;
  toId: string;
  kind: RelationKind;
}

export type EventKind = 'activity' | 'note' | 'qc' | 'hse' | 'milestone' | (string & {});
export interface EventQcMark { status: 'approved' | 'flagged'; note?: string; }

/** Append-only. Corrections are new events; never mutate an existing one. */
export interface TimelineEvent {
  id: string;
  orgId: string;
  ticketId: string;
  seq: number;       // monotonic per ticket (assigned on append)
  atMin: number;     // minute-of-day on the 24h axis (caller-supplied)
  kind: EventKind;
  code?: string;
  note?: string;
  qc?: EventQcMark;
}

export interface CodedGraph {
  objects: CodedObject[];
  relations: Relation[];
}

export interface TicketView {
  section: CodedObject;
  parties: CodedObject[];
  equipment: CodedObject[];
  bha: CodedObject[];
  timeline: TimelineEvent[];  // ordered by seq
  warnings: string[];
}
