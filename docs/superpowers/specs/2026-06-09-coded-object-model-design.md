# Slice B — Coded-object model + Ticket (design)

**Parent architecture:** `docs/superpowers/specs/2026-06-08-operations-architecture-design.md` (substrate = coded-object graph + timeline/QC event log; central object = the coded Section/"Ticket"). This spec details that substrate as a shippable `@valor/core` + MockRepository foundation.

**Goal:** Introduce the coded-object graph + the Section/Ticket + an append-only timeline/QC event log as a pure, tested `@valor/core` capability persisted through the Repository seam — the substrate every later plane attaches to. **Additive and non-breaking:** it ships alongside the existing storage; no UI and no rewiring of the current Rig-Day/Well-Setup workspaces (Slice E wires the Ticket board to this).

## Key design decisions

1. **One primitive — `CodedObject`.** Every entity (section, party, equipment, BHA, …) is a `CodedObject` with a `type`, an optional `code` (into the Bank / a type's catalog), a `label`, and a typed-EAV `fields` map. New object/field types are config (Bank + `TemplateFieldDef`), not code — the "structural simplicity" thesis.
2. **Edges — `Relation`.** A separate `{ fromId, toId, kind }` edge table links objects (e.g. a party `assigned` to a section, equipment `uses`-d by a section, a section whose `parent` is a job). The graph = objects + relations.
3. **The Ticket is a `CodedObject` of type `'section'`** — not a new storage shape. The **Rig-Day is its timeline view**, the **Job is its `parent`** (a relation), the **Well its `place`** (a relation). A `TicketView` assembles the section + its related objects + its timeline.
4. **Timeline/QC event log is append-only** (the A+C hybrid). Events carry a monotonic `seq`; **corrections are new events, never mutations** — giving a replayable/auditable day + QC trail. `at` (time) and `seq` are supplied/derived deterministically (no `Date.now`/`Math.random` in core).
5. **Slice B is additive.** Existing Rig-Day/Well-Setup storage is untouched; the model proves out with seed data + tests. The facet-mapping (Rig-Day = the Ticket's `timeline`; Well-Setup = the section's condition-state fields) is the **Slice E** integration, documented here, not built now.

## Core model — `packages/core/src/coded-object/`

### `types.ts`
```ts
export type ObjectType = 'section' | 'party' | 'equipment' | 'bha' | 'well' | 'job' | string;
export type FieldValue = string | number | boolean | null;

export interface CodedObject {
  id: string;
  orgId: string;
  type: ObjectType;
  code?: string;                 // FK into the Bank (or a type catalog), optional
  label?: string;
  fields: Record<string, FieldValue>;  // typed-EAV; validated vs TemplateFieldDef at the app layer
}

export type RelationKind = 'parent' | 'place' | 'assigned' | 'uses' | string;
export interface Relation {
  id: string;
  orgId: string;
  fromId: string;                // e.g. the section
  toId: string;                  // e.g. the party / equipment / job / well
  kind: RelationKind;
}

export type EventKind = 'activity' | 'note' | 'qc' | 'hse' | 'milestone' | string;
export interface QcMark { status: 'approved' | 'flagged'; note?: string; }

/** Append-only. Corrections are new events; never mutate an existing one. */
export interface TimelineEvent {
  id: string;
  orgId: string;
  ticketId: string;              // the section CodedObject.id this belongs to
  seq: number;                   // monotonic per ticket (assigned on append)
  atMin: number;                 // minute-of-day on the 24h axis (caller-supplied; deterministic)
  kind: EventKind;
  code?: string;                 // Bank code for activity events
  note?: string;
  qc?: QcMark;
}

export interface CodedGraph { objects: CodedObject[]; relations: Relation[]; }

export interface TicketView {
  section: CodedObject;
  parties: CodedObject[];
  equipment: CodedObject[];
  bha: CodedObject[];
  timeline: TimelineEvent[];     // ordered by seq
  warnings: string[];
}
```

### `graph.ts` (pure helpers, `warnings[]`, no `Date.now`/`Math.random`)
- `objectsByType(graph, type): CodedObject[]`
- `relatedObjects(graph, fromId, kind?): CodedObject[]` — resolves edges from `fromId` to their target objects (optionally filtered by kind), skipping dangling edges (→ warning).
- `nextSeq(events, ticketId): number` — max existing `seq` for the ticket + 1 (deterministic; the repository uses this on append).
- `assembleTicket(graph, events, ticketId): TicketView | null` — null if no section with that id/type; else assembles parties (`assigned`), equipment (`uses`), bha (`uses` + type `bha`), timeline (events for the ticket, sorted by `seq`), and warnings (dangling relations, out-of-order seq, unknown Bank codes via `findBankCode`).

### `seed.ts`
- `DEFAULT_CODED_GRAPH` + `DEFAULT_TIMELINE`: one seed section Ticket (brand-scrubbed, e.g. `code: 'DRL'`, fields: section name/diameter/planned-actual/status) + 2 parties + 2 equipment + 1 BHA object, the relations linking them, and ~4 timeline events (activity + a qc mark) referencing Bank codes — so the model has demo data and `assembleTicket` is exercised end-to-end.

## Repository extension (additive — interface + MockRepository)

Add to the `Repository` interface and `MockRepository` (mock keys `valor:codedobjects`, `valor:relations`, `valor:timeline:{ticketId}`; in-memory maps for node):
- `saveCodedObject(obj: CodedObject): Promise<void>` (upsert by id)
- `loadCodedObjects(orgId: string, type?: ObjectType): Promise<CodedObject[]>`
- `saveRelation(rel: Relation): Promise<void>` (upsert by id)
- `loadRelations(orgId: string): Promise<Relation[]>`
- `loadCodedGraph(orgId: string): Promise<CodedGraph>` (objects + relations)
- `appendTimelineEvent(e: Omit<TimelineEvent,'seq'> & { seq?: number }): Promise<TimelineEvent>` — assigns `seq = nextSeq(...)` if not given; **append-only** (never overwrites); returns the stored event.
- `loadTimeline(ticketId: string): Promise<TimelineEvent[]>` (ordered by `seq`)

Mirrors the existing module-table persistence patterns (the same `valor:*` localStorage / in-memory map approach already used for dashboards/rig-days/etc.).

**`SupabaseRepository` must stay compiling.** Because it `implements Repository`, adding these 7 methods to the interface forces stubs there or `@valor/web` typecheck fails (same lesson as the local-db methods). Slice B adds **throwing stubs** to `SupabaseRepository` — each throws a clear `"coded-object graph not implemented in the Supabase scaffold (Slice B is mock-only)"` error — keeping the interface contract satisfied and the mock the only working path. Real cloud graph tables (coded_objects/relations/timeline_events + RLS) are a later step alongside Auth/SSR.

## Out of scope (deferred)
- UI / Ticket board / Day board (Slices E, F).
- Rewiring Rig-Day/Well-Setup to read from the graph (Slice E; the facet mapping is documented above).
- Supabase coded_objects/relations/events tables + RLS + adapter methods (a later cloud step, alongside Auth/SSR).

## Testing
- **Model (`graph.test.ts`):** `objectsByType`, `relatedObjects` (incl. dangling-edge warning), `nextSeq`, `assembleTicket` over `DEFAULT_CODED_GRAPH`/`DEFAULT_TIMELINE` (asserts parties/equipment/bha resolved, timeline seq-ordered, warnings on unknown code).
- **Repository (`mock-repository.coded-object.test.ts`):** save objects/relations/events → load → `loadCodedGraph` + `assembleTicket` round-trips; `appendTimelineEvent` assigns increasing `seq` and is append-only (a second append doesn't drop the first); `loadCodedObjects(org, type)` filters.
- Determinism: no `Date.now`/`Math.random` in core; `atMin`/ids caller-supplied; `seq` derived from existing events.

## Success criteria
`@valor/core` typecheck 0 + new tests green (model + repository round-trip); existing 162 core tests unaffected; `@valor/web` unaffected (additive interface methods implemented in MockRepository; web still builds — both normal and static export); the seed Ticket assembles into a complete `TicketView`.
