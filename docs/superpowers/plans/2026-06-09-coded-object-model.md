# Coded-object model + Ticket (Slice B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the coded-object graph + the Section/Ticket + an append-only timeline/QC event log as a pure, tested `@valor/core` capability persisted through the Repository seam — additive and mock-only, no UI.

**Architecture:** One `CodedObject` primitive (type + optional Bank `code` + typed-EAV `fields`) + a `Relation` edge table = the graph. The Ticket is a `CodedObject` of `type: 'section'`; pure helpers in `graph.ts` assemble a `TicketView` (section + related parties/equipment/bha + timeline). An append-only `TimelineEvent` log (monotonic `seq`) gives the replayable day. `MockRepository` persists it (mirroring the existing `valor:*` / in-memory pattern); `SupabaseRepository` gets throwing stubs so the interface contract holds.

**Tech Stack:** TypeScript, `@valor/core` (pure, Vitest node), `@valor/web` (Next 15, typecheck only here). Branch: `feat/coded-object-model` (already created). Spec: `docs/superpowers/specs/2026-06-09-coded-object-model-design.md`.

**Constraints:** No `Date.now`/`Math.random` in `@valor/core`. `warnings: string[]`, never throw (except the deliberate Supabase stubs). Existing 162 core tests stay green; `@valor/web` typecheck 0 + both builds (normal + static export) pass.

Commands (from repo root `C:\Users\Deving-1\Desktop\dev\ValorOperations_SB`):
- Core one file: `corepack pnpm --filter @valor/core test -- <name>`
- Core all: `corepack pnpm --filter @valor/core test` · Core typecheck: `corepack pnpm --filter @valor/core typecheck`
- Web typecheck: `corepack pnpm --filter @valor/web typecheck`

---

## File Structure
- **Create `packages/core/src/coded-object/types.ts`** — the model types.
- **Create `packages/core/src/coded-object/graph.ts`** — pure helpers (`objectsByType`, `relatedObjects`, `nextSeq`, `assembleTicket`).
- **Create `packages/core/src/coded-object/seed.ts`** — `DEFAULT_CODED_GRAPH` + `DEFAULT_TIMELINE`.
- **Modify `packages/core/src/index.ts`** — export the coded-object module.
- **Modify `packages/core/src/repository.ts`** — add 7 method signatures to `Repository`.
- **Modify `packages/core/src/mock-repository.ts`** — implement the 7 methods + in-memory fields.
- **Modify `apps/web/lib/supabase-repository.ts`** — 7 throwing stubs.
- **Test `packages/core/test/coded-object-graph.test.ts`** and **`packages/core/test/mock-repository.coded-object.test.ts`**.

---

### Task 1: Core model — types, graph helpers, seed

**Files:**
- Create: `packages/core/src/coded-object/types.ts`, `packages/core/src/coded-object/graph.ts`, `packages/core/src/coded-object/seed.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/coded-object-graph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/coded-object-graph.test.ts
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
    // dangling 'ghost' target is skipped (not thrown, not included)
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
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `corepack pnpm --filter @valor/core test -- coded-object-graph`
Expected: FAIL — cannot resolve `../src/coded-object/graph`.

- [ ] **Step 3: Implement `types.ts`**

```ts
// packages/core/src/coded-object/types.ts
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
export interface QcMark { status: 'approved' | 'flagged'; note?: string; }

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
  qc?: QcMark;
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
```

- [ ] **Step 4: Implement `graph.ts`**

```ts
// packages/core/src/coded-object/graph.ts
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

  const resolve = (kind: RelationKind, type: ObjectType): CodedObject[] =>
    graph.relations
      .filter((r) => r.fromId === ticketId && r.kind === kind)
      .map((r) => {
        const o = byId.get(r.toId);
        if (!o) warnings.push(`Relation ${r.id} (${kind}) points to missing object ${r.toId}.`);
        return o;
      })
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
```

- [ ] **Step 5: Implement `seed.ts`**

```ts
// packages/core/src/coded-object/seed.ts
import type { CodedGraph, TimelineEvent } from './types';

export const SEED_TICKET_ID = 'sec-int-1';
const ORG = 'org-valor';

export const DEFAULT_CODED_GRAPH: CodedGraph = {
  objects: [
    {
      id: SEED_TICKET_ID, orgId: ORG, type: 'section', code: 'DRL', label: '12¼" Intermediate',
      fields: { sectionName: 'Intermediate', diameterIn: 12.25, status: 'in_progress', plannedStartMin: 0, plannedEndMin: 1440 },
    },
    { id: 'party-dd', orgId: ORG, type: 'party', code: 'DD', label: 'Directional Driller', fields: { onsite: true } },
    { id: 'party-mud', orgId: ORG, type: 'party', code: 'MUD', label: 'Mud Engineer', fields: { onsite: true } },
    { id: 'equip-rig', orgId: ORG, type: 'equipment', code: 'RIG', label: 'Rig', fields: {} },
    { id: 'equip-pumps', orgId: ORG, type: 'equipment', code: 'PUMPS', label: 'Triplex Pumps', fields: { count: 2 } },
    { id: 'bha-1', orgId: ORG, type: 'bha', label: 'Rotary BHA #1', fields: { bitSizeIn: 12.25 } },
    { id: 'job-1', orgId: ORG, type: 'job', label: 'Drill Intermediate', fields: {} },
  ],
  relations: [
    { id: 'rel-parent', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'job-1', kind: 'parent' },
    { id: 'rel-p1', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'party-dd', kind: 'assigned' },
    { id: 'rel-p2', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'party-mud', kind: 'assigned' },
    { id: 'rel-e1', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'equip-rig', kind: 'uses' },
    { id: 'rel-e2', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'equip-pumps', kind: 'uses' },
    { id: 'rel-b1', orgId: ORG, fromId: SEED_TICKET_ID, toId: 'bha-1', kind: 'uses' },
  ],
};

export const DEFAULT_TIMELINE: TimelineEvent[] = [
  { id: 'ev-1', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 1, atMin: 0, kind: 'activity', code: 'TIH', note: 'Trip in hole' },
  { id: 'ev-2', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 2, atMin: 120, kind: 'activity', code: 'DRL', note: 'Drilling ahead' },
  { id: 'ev-3', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 3, atMin: 510, kind: 'activity', code: 'RIGREP', note: 'Rig repair (NPT)' },
  { id: 'ev-4', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 4, atMin: 600, kind: 'qc', qc: { status: 'approved', note: 'Tower QC complete' } },
];
```

- [ ] **Step 6: Export from `packages/core/src/index.ts`**

Add after the other `compute`/module exports (e.g. after `export * from './compute/directional-survey';`):

```ts
export * from './coded-object/graph';
```

(Note: `graph.ts` re-exports `./types` and the seed, so this single line surfaces the whole module. Do NOT also `export * from './coded-object/types'` — it would double-export the same names.)

- [ ] **Step 7: Run the test + core typecheck, verify pass**

Run: `corepack pnpm --filter @valor/core test -- coded-object-graph` → PASS (6 tests).
Run: `corepack pnpm --filter @valor/core typecheck` → exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/coded-object/ packages/core/src/index.ts packages/core/test/coded-object-graph.test.ts
git commit -m "feat(core): coded-object model — graph + Ticket + timeline (pure)"
```

---

### Task 2: Repository interface + MockRepository persistence

**Files:**
- Modify: `packages/core/src/repository.ts` (add 7 signatures to `Repository`)
- Modify: `packages/core/src/mock-repository.ts` (in-memory fields + 7 methods)
- Test: `packages/core/test/mock-repository.coded-object.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/mock-repository.coded-object.test.ts
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
    const repo = new MockRepository();
    const e = await repo.appendTimelineEvent({ id: 'e9', orgId: ORG, ticketId: 's1', seq: 42, atMin: 5, kind: 'note' });
    expect(e.seq).toBe(42);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `corepack pnpm --filter @valor/core test -- mock-repository.coded-object`
Expected: FAIL — `saveCodedObject` is not a function / not on `Repository`.

- [ ] **Step 3: Add the 7 signatures to `packages/core/src/repository.ts`**

Add inside the `Repository` interface, immediately before its closing `}` (after the existing `resetLocalDb(): Promise<void>;` line):

```ts
  // --- coded-object graph (Slice B) ---
  saveCodedObject(obj: import('./coded-object/types').CodedObject): Promise<void>;
  loadCodedObjects(orgId: string, type?: import('./coded-object/types').ObjectType): Promise<import('./coded-object/types').CodedObject[]>;
  saveRelation(rel: import('./coded-object/types').Relation): Promise<void>;
  loadRelations(orgId: string): Promise<import('./coded-object/types').Relation[]>;
  loadCodedGraph(orgId: string): Promise<import('./coded-object/types').CodedGraph>;
  appendTimelineEvent(event: Omit<import('./coded-object/types').TimelineEvent, 'seq'> & { seq?: number }): Promise<import('./coded-object/types').TimelineEvent>;
  loadTimeline(ticketId: string): Promise<import('./coded-object/types').TimelineEvent[]>;
```

- [ ] **Step 4: Add in-memory fields to `MockRepository`**

In `packages/core/src/mock-repository.ts`, add these fields next to the existing private fields (after `private afe: ... | null = null;`):

```ts
  private codedObjects: import('./coded-object/types').CodedObject[] | null = null;
  private relationsList: import('./coded-object/types').Relation[] | null = null;
  private timelines: Record<string, import('./coded-object/types').TimelineEvent[]> | null = null;
```

- [ ] **Step 5: Add the 7 methods to `MockRepository`**

Add these methods (near the other collection methods, e.g. after `loadAfe`). They follow the existing `browserStorage`-vs-in-memory + `valor:*` single-key pattern, with read-modify-write upserts. Uses `nextSeq` from the graph module.

```ts
  async saveCodedObject(obj: import('./coded-object/types').CodedObject): Promise<void> {
    // Upsert by id: drop any existing object with this id, then append.
    const others = (await this.allCodedObjects()).filter((o) => o.id !== obj.id);
    this.writeCodedObjects([...others, structuredClone(obj)]);
  }
  async loadCodedObjects(orgId: string, type?: import('./coded-object/types').ObjectType): Promise<import('./coded-object/types').CodedObject[]> {
    return (await this.allCodedObjects()).filter((o) => o.orgId === orgId && (type === undefined || o.type === type));
  }
  async saveRelation(rel: import('./coded-object/types').Relation): Promise<void> {
    const others = (await this.allRelations()).filter((r) => r.id !== rel.id);
    this.writeRelations([...others, structuredClone(rel)]);
  }
  async loadRelations(orgId: string): Promise<import('./coded-object/types').Relation[]> {
    return (await this.allRelations()).filter((r) => r.orgId === orgId);
  }
  async loadCodedGraph(orgId: string): Promise<import('./coded-object/types').CodedGraph> {
    return { objects: await this.loadCodedObjects(orgId), relations: await this.loadRelations(orgId) };
  }
  async appendTimelineEvent(
    event: Omit<import('./coded-object/types').TimelineEvent, 'seq'> & { seq?: number },
  ): Promise<import('./coded-object/types').TimelineEvent> {
    const { nextSeq } = await import('./coded-object/graph');
    const existing = await this.loadTimeline(event.ticketId);
    const seq = event.seq ?? nextSeq(existing, event.ticketId);
    const stored: import('./coded-object/types').TimelineEvent = { ...event, seq };
    const map = await this.allTimelines();
    map[event.ticketId] = [...(map[event.ticketId] ?? []), structuredClone(stored)];
    this.writeTimelines(map);
    return stored;
  }
  async loadTimeline(ticketId: string): Promise<import('./coded-object/types').TimelineEvent[]> {
    return [...((await this.allTimelines())[ticketId] ?? [])].sort((a, b) => a.seq - b.seq);
  }

  // --- coded-object storage helpers (browser localStorage or in-memory) ---
  private async allCodedObjects(): Promise<import('./coded-object/types').CodedObject[]> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:codedobjects'); if (raw) { try { return JSON.parse(raw) as import('./coded-object/types').CodedObject[]; } catch { return []; } } return []; }
    return this.codedObjects ? structuredClone(this.codedObjects) : [];
  }
  private writeCodedObjects(list: import('./coded-object/types').CodedObject[]): void {
    const store = this.browserStorage;
    if (store) store.setItem('valor:codedobjects', JSON.stringify(list));
    else this.codedObjects = structuredClone(list);
  }
  private async allRelations(): Promise<import('./coded-object/types').Relation[]> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:relations'); if (raw) { try { return JSON.parse(raw) as import('./coded-object/types').Relation[]; } catch { return []; } } return []; }
    return this.relationsList ? structuredClone(this.relationsList) : [];
  }
  private writeRelations(list: import('./coded-object/types').Relation[]): void {
    const store = this.browserStorage;
    if (store) store.setItem('valor:relations', JSON.stringify(list));
    else this.relationsList = structuredClone(list);
  }
  private async allTimelines(): Promise<Record<string, import('./coded-object/types').TimelineEvent[]>> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:timelines'); if (raw) { try { return JSON.parse(raw) as Record<string, import('./coded-object/types').TimelineEvent[]>; } catch { return {}; } } return {}; }
    return this.timelines ? structuredClone(this.timelines) : {};
  }
  private writeTimelines(map: Record<string, import('./coded-object/types').TimelineEvent[]>): void {
    const store = this.browserStorage;
    if (store) store.setItem('valor:timelines', JSON.stringify(map));
    else this.timelines = structuredClone(map);
  }
```

- [ ] **Step 6: Run the test + core typecheck, verify pass**

Run: `corepack pnpm --filter @valor/core test -- mock-repository.coded-object` → PASS (5 tests).
Run: `corepack pnpm --filter @valor/core typecheck` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/repository.ts packages/core/src/mock-repository.ts packages/core/test/mock-repository.coded-object.test.ts
git commit -m "feat(core): Repository + MockRepository coded-object graph persistence (append-only timeline)"
```

---

### Task 3: SupabaseRepository throwing stubs

**Files:**
- Modify: `apps/web/lib/supabase-repository.ts`

- [ ] **Step 1: Add the type imports**

In the `import { ... } from '@valor/core'` type block in `apps/web/lib/supabase-repository.ts`, add (as type imports):

```ts
  type CodedObject,
  type Relation,
  type CodedGraph,
  type TimelineEvent,
  type ObjectType,
```

- [ ] **Step 2: Add the 7 throwing stubs**

Add these methods to the `SupabaseRepository` class (e.g. after `resetLocalDb`). A single private helper keeps them DRY:

```ts
  // --- coded-object graph (Slice B is mock-only; cloud graph tables are a later step) ---
  private codedObjectsUnsupported(method: string): never {
    throw new Error(
      `SupabaseRepository.${method}: coded-object graph not implemented in the Supabase scaffold (Slice B is mock-only).`,
    );
  }
  async saveCodedObject(_obj: CodedObject): Promise<void> { this.codedObjectsUnsupported('saveCodedObject'); }
  async loadCodedObjects(_orgId: string, _type?: ObjectType): Promise<CodedObject[]> { this.codedObjectsUnsupported('loadCodedObjects'); }
  async saveRelation(_rel: Relation): Promise<void> { this.codedObjectsUnsupported('saveRelation'); }
  async loadRelations(_orgId: string): Promise<Relation[]> { this.codedObjectsUnsupported('loadRelations'); }
  async loadCodedGraph(_orgId: string): Promise<CodedGraph> { this.codedObjectsUnsupported('loadCodedGraph'); }
  async appendTimelineEvent(_event: Omit<TimelineEvent, 'seq'> & { seq?: number }): Promise<TimelineEvent> { this.codedObjectsUnsupported('appendTimelineEvent'); }
  async loadTimeline(_ticketId: string): Promise<TimelineEvent[]> { this.codedObjectsUnsupported('loadTimeline'); }
```

(The `never`-returning helper satisfies every return type, so no `return` is needed. The `_`-prefixed params avoid unused-var lint.)

- [ ] **Step 3: Web typecheck, verify pass**

Run: `corepack pnpm --filter @valor/web typecheck`
Expected: exit 0 (SupabaseRepository now satisfies the full `Repository` interface again).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/supabase-repository.ts
git commit -m "feat(web): SupabaseRepository coded-object stubs (throw; Slice B is mock-only)"
```

---

### Task 4: Verify — core suite, web, both builds

**Files:** none (verification only)

- [ ] **Step 1: Full core suite + typecheck**

Run: `corepack pnpm --filter @valor/core test` → all pass (162 existing + 11 new = 173).
Run: `corepack pnpm --filter @valor/core typecheck` → exit 0.

- [ ] **Step 2: Web typecheck + tests + normal build**

Run: `corepack pnpm --filter @valor/web typecheck` → exit 0.
Run: `corepack pnpm --filter @valor/web test` → all pass (117 + 1 todo, unchanged — additive interface).
Run: `corepack pnpm --filter @valor/web build` → "Compiled successfully", exit 0.

- [ ] **Step 3: Static-export build (PowerShell, no MSYS path-mangling)**

```powershell
Remove-Item -Recurse -Force apps/web/.next, apps/web/out -ErrorAction SilentlyContinue
$env:STATIC_EXPORT='true'; $env:PAGES_BASE_PATH='ValorOperations_SB'
corepack pnpm --filter @valor/web build
```
Expected: "Generating static pages (20/20)", exit 0.

- [ ] **Step 4: Clean export env + open PR**

```bash
git push -u origin feat/coded-object-model
gh pr create --base master --head feat/coded-object-model --title "feat: coded-object model + Ticket (architecture Slice B)" --body-file <temp file: summary + test plan>
```
Then run the standard dual-bot review loop (CodeRabbit + Copilot), action-or-justify every finding, and merge.

---

## Self-Review

**1. Spec coverage:**
- CodedObject/Relation/TimelineEvent/CodedGraph/TicketView types → Task 1 (`types.ts`) ✓
- graph helpers objectsByType/relatedObjects/nextSeq/assembleTicket → Task 1 (`graph.ts`) ✓
- seed graph + timeline → Task 1 (`seed.ts`) ✓
- index export → Task 1 Step 6 ✓
- Repository interface +7 methods → Task 2 Step 3 ✓
- MockRepository impl (append-only seq, type filter, round-trip) → Task 2 ✓
- SupabaseRepository stubs (keep web typecheck) → Task 3 ✓
- Determinism (no Date.now/Math.random; atMin/ids caller-supplied; seq derived) → types + impl honor this ✓
- Tests (graph + repository) → Tasks 1 & 2 ✓
- Both builds pass / existing tests green → Task 4 ✓
- Additive, no UI, no rewiring → confirmed (only new files + additive interface + stubs) ✓

**2. Placeholder scan:** none — every step has full code or exact commands. (Task 2 Step 5 shows a defensive variant then the clean `saveCodedObject` to use; the clean one is explicit.)

**3. Type consistency:** `CodedObject`/`Relation`/`TimelineEvent`/`CodedGraph`/`TicketView`/`ObjectType`/`RelationKind`/`EventKind`/`QcMark`, `objectsByType`/`relatedObjects`/`nextSeq`/`assembleTicket`, `SEED_TICKET_ID`/`DEFAULT_CODED_GRAPH`/`DEFAULT_TIMELINE`, and the 7 repo method names are identical across the spec, interface, MockRepository, SupabaseRepository stubs, and tests. Mock storage keys (`valor:codedobjects`/`valor:relations`/`valor:timelines`) are consistent. `appendTimelineEvent` input type (`Omit<TimelineEvent,'seq'> & { seq?: number }`) matches in interface, mock, stub, and tests.
