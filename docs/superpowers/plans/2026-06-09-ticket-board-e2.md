# Rig-Day as the Ticket's time-view (Slice E2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the keystone — a `/tickets/[ticketId]` page that renders a Ticket's append-only `TimelineEvent` log through the **existing** rig-day visual components, with new activities appended via the Bank palette.

**Architecture:** A pure `timelineToRigDay(ticket: TicketView): RigDay` adapter in `@valor/core` projects a ticket's timeline + related parties/equipment into the `RigDay` shape the rig-day components already consume (activity events → `TimeBlock`s spanning to the next activity's `atMin`/1440; `qc` events → a `QcMark` on the covering block; parties/equipment → full-day `LaneItem`s). The page (a server wrapper + a client view) loads the graph (seed-fallback), assembles + projects it, and reuses `RigDayTimeline` / `RigDayLanes` / `TimeAccountingRail` / `NotificationsPanel` unchanged. Appends go through `appendTimelineEvent` (append-only); the `RigDay` storage model is untouched (the standalone `/rig-day` console keeps full block editing).

**Tech Stack:** TypeScript, `@valor/core` (pure, Vitest node), `@valor/web` (Next 15 App Router, React 19, Tailwind, Vitest/jsdom + @testing-library/react). Branch: `feat/ticket-board-e2` (create off master). Spec: `docs/superpowers/specs/2026-06-09-ticket-board-design.md` (E2 section).

**Constraints:** No `Date.now`/`Math.random` in `@valor/core`. Additive — the existing `/rig-day` console + all prior slices untouched; both typechecks 0; both web builds (normal + static export) pass. MockRepository stays default. IP guardrail: generic terms only.

Commands (run from the repository root):
- Core: `corepack pnpm --filter @valor/core test -- <name>` / `test` / `typecheck`
- Web: `corepack pnpm --filter @valor/web test -- <name>` / `test` / `typecheck` / `build`

Exact reference shapes (verbatim from the codebase):
- `RigDay { id; label; blocks: TimeBlock[]; people?: LaneItem[]; equipment?: LaneItem[] }`
- `TimeBlock { id; code; startMin; endMin; depthStartFt?; depthEndFt?; note?; qc? }`; `LaneItem { id; code; label; startMin; endMin }`; `QcMark { status: 'approved'|'flagged'; note? }`; `DAY_MINUTES = 1440`.
- `TimelineEvent { id; orgId; ticketId; seq; atMin; kind; code?; note?; qc? }` (`qc?: EventQcMark { status; note? }`).
- `TicketView { section; parties; equipment; bha; timeline; warnings }`.
- Components: `RigDayTimeline({ day: RigDay; onSelect?: (id: string) => void })`; `RigDayLanes({ day: RigDay; progress: ProgressPoint[] })`; `TimeAccountingRail({ accounting: TimeAccounting })`; `NotificationsPanel({ notifications: Notification[] })`.
- `deriveTimeAccounting(blocks: TimeBlock[], nowMin?): TimeAccounting`; `deriveProgress(blocks): ProgressPoint[]`; `deriveNotifications(rigDay: RigDay, rules?): Notification[]`.
- Repo: `appendTimelineEvent(event: Omit<TimelineEvent,'seq'> & { seq?: number }): Promise<TimelineEvent>`; `loadTimeline(orgId, ticketId)`; `loadCodedGraph(orgId)`.
- Static-export route precedent (`wells/[wellId]`): `export async function generateStaticParams()` returns `[]` unless `process.env.STATIC_EXPORT === 'true'`; server component reads `params: Promise<{...}>`; client children use `useParams()`.

---

## File Structure
- **Create `packages/core/src/coded-object/timeline-view.ts`** — pure `timelineToRigDay(ticket): RigDay`.
- **Modify `packages/core/src/coded-object/graph.ts`** — re-export `./timeline-view`.
- **Create `packages/core/test/coded-object-timeline-view.test.ts`**.
- **Create `apps/web/app/(hub)/tickets/[ticketId]/page.tsx`** — server wrapper (generateStaticParams + reads param).
- **Create `apps/web/components/ticket-time-view.tsx`** — the client time-view.
- **Test `apps/web/__tests__/ticket-time-view.test.tsx`**.

---

### Task 1: Core — `timelineToRigDay` adapter

**Files:**
- Create: `packages/core/src/coded-object/timeline-view.ts`
- Modify: `packages/core/src/coded-object/graph.ts`
- Test: `packages/core/test/coded-object-timeline-view.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/core/test/coded-object-timeline-view.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assembleTicket, timelineToRigDay, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID } from '../src/coded-object/graph';

describe('timelineToRigDay', () => {
  const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;

  it('projects activity events into blocks that span to the next activity', () => {
    const day = timelineToRigDay(view);
    // DEFAULT_TIMELINE activities: TIH@0, DRL@120, RIGREP@510 (ev-4 is a qc event, not an activity)
    expect(day.blocks.map((b) => b.code)).toEqual(['TIH', 'DRL', 'RIGREP']);
    expect(day.blocks.map((b) => [b.startMin, b.endMin])).toEqual([[0, 120], [120, 510], [510, 1440]]);
  });

  it('attaches a qc event to the block whose span covers it', () => {
    const day = timelineToRigDay(view);
    // ev-4 qc @ 600 falls inside the RIGREP block [510,1440].
    const rigrep = day.blocks.find((b) => b.code === 'RIGREP')!;
    expect(rigrep.qc?.status).toBe('approved');
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
```

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/core test -- coded-object-timeline-view`
Expected: FAIL — `timelineToRigDay` not exported.

- [ ] **Step 3: Create `packages/core/src/coded-object/timeline-view.ts`**

```ts
import type { RigDay, TimeBlock, LaneItem } from '../rig-day/types';
import { DAY_MINUTES } from '../rig-day/types';
import type { CodedObject, TicketView } from './types';

/** A CodedObject → LaneItem present for the whole operational day. */
function laneFrom(o: CodedObject): LaneItem {
  return { id: o.id, code: o.code ?? 'UNKNOWN', label: o.label ?? o.code ?? o.id, startMin: 0, endMin: DAY_MINUTES };
}

/**
 * Project a Ticket (section + append-only timeline + related objects) into the `RigDay`
 * shape the existing rig-day visual components consume. Pure/deterministic.
 *
 * - Only `activity` events become blocks; each spans from its `atMin` to the NEXT activity's
 *   `atMin` (or `DAY_MINUTES` for the last). Activities are taken in seq order.
 * - A `qc` event's mark is attached to the block whose [startMin, endMin) covers its `atMin`.
 * - Parties → `people` lanes, equipment → `equipment` lanes (present the full day).
 * - Depth is unavailable in the timeline schema, so blocks carry no depth (progress is empty).
 */
export function timelineToRigDay(ticket: TicketView): RigDay {
  const { section, parties, equipment, timeline } = ticket;
  const activities = timeline.filter((e) => e.kind === 'activity' && e.code);

  const blocks: TimeBlock[] = activities.map((e, i) => {
    const next = activities[i + 1];
    const endMin = next ? next.atMin : DAY_MINUTES;
    return { id: e.id, code: e.code as string, startMin: e.atMin, endMin, ...(e.note ? { note: e.note } : {}) };
  });

  // Attach each qc event to the covering block (first block whose span contains atMin).
  for (const e of timeline) {
    if (e.kind !== 'qc' || !e.qc) continue;
    const block = blocks.find((b) => e.atMin >= b.startMin && e.atMin < b.endMin);
    if (block) block.qc = { status: e.qc.status, ...(e.qc.note ? { note: e.qc.note } : {}) };
  }

  return {
    id: section.id,
    label: section.label ?? section.code ?? section.id,
    blocks,
    people: parties.map(laneFrom),
    equipment: equipment.map(laneFrom),
  };
}
```

- [ ] **Step 4: Re-export from `graph.ts`** — add next to the other coded-object re-exports:

```ts
export * from './timeline-view';
```

- [ ] **Step 5: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/core test -- coded-object-timeline-view` → PASS (4). `corepack pnpm --filter @valor/core typecheck` → 0. `corepack pnpm --filter @valor/core test` → full suite green.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/coded-object/timeline-view.ts packages/core/src/coded-object/graph.ts packages/core/test/coded-object-timeline-view.test.ts
git commit -m "feat(core): timelineToRigDay — project a Ticket timeline into the RigDay view shape"
```
End every commit body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 2: Web — `/tickets/[ticketId]` time-view

**Files:**
- Create: `apps/web/app/(hub)/tickets/[ticketId]/page.tsx`, `apps/web/components/ticket-time-view.tsx`
- Test: `apps/web/__tests__/ticket-time-view.test.tsx`

- [ ] **Step 1: Write the failing test** — create `apps/web/__tests__/ticket-time-view.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { SEED_TICKET_ID } from '@valor/core';
import { TicketTimeView } from '@/components/ticket-time-view';

describe('TicketTimeView', () => {
  it('renders the seed ticket label after loading', async () => {
    const { findByText } = render(<TicketTimeView ticketId={SEED_TICKET_ID} />);
    expect(await findByText(/12¼" Intermediate/)).toBeTruthy();
  });

  it('shows a not-found state for an unknown ticket', async () => {
    const { findByText } = render(<TicketTimeView ticketId="does-not-exist" />);
    expect(await findByText(/not found/i)).toBeTruthy();
  });
});
```

(These exercise the seed-fallback load path against the default MockRepository — `getRepo()` returns the mock in tests; `loadCodedGraph` is empty so the view falls back to the seed graph, and `assembleTicket` resolves the seed ticket.)

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/web test -- ticket-time-view`
Expected: FAIL — cannot resolve `@/components/ticket-time-view`.

- [ ] **Step 3: Implement `apps/web/components/ticket-time-view.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import {
  assembleTicket,
  objectsByType,
  timelineToRigDay,
  deriveTimeAccounting,
  deriveProgress,
  deriveNotifications,
  DEFAULT_CODED_GRAPH,
  DEFAULT_TIMELINE,
  BANK_SEED,
  type CodedGraph,
  type TimelineEvent,
  type BankCode,
  type RigDay,
} from '@valor/core';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState, EmptyState } from '@/components/ui/states';
import { RigDayTimeline } from '@/components/rig-day-timeline';
import { RigDayLanes } from '@/components/rig-day-lanes';
import { TimeAccountingRail } from '@/components/time-accounting-rail';
import { NotificationsPanel } from '@/components/notifications-panel';
import { BankSearchPalette } from '@/components/bank-search-palette';

const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

export function TicketTimeView({ ticketId }: { ticketId: string }) {
  const [day, setDay] = useState<RigDay | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [bankCodes, setBankCodes] = useState<BankCode[]>(BANK_SEED);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const load = useMemo(
    () => async () => {
      const repo = getRepo();
      let graph: CodedGraph = await repo.loadCodedGraph(DEMO_ORG_ID);
      let usingSeed = false;
      if (objectsByType(graph, 'section').length === 0) {
        graph = DEFAULT_CODED_GRAPH;
        usingSeed = true;
      }
      let events: TimelineEvent[] = await repo.loadTimeline(DEMO_ORG_ID, ticketId);
      if (events.length === 0 && usingSeed) events = DEFAULT_TIMELINE.filter((e) => e.ticketId === ticketId);
      const view = assembleTicket(graph, events, ticketId);
      return view;
    },
    [ticketId],
  );

  useEffect(() => {
    let active = true;
    load()
      .then((view) => {
        if (!active) return;
        setDay(view ? timelineToRigDay(view) : null);
        setWarnings(view?.warnings ?? []);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    let active = true;
    getRepo().loadBankCodes().then((stored) => { if (active && stored) setBankCodes(stored); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const accounting = useMemo(() => (day ? deriveTimeAccounting(day.blocks) : null), [day]);
  const progress = useMemo(() => (day ? deriveProgress(day.blocks) : []), [day]);
  const notifications = useMemo(() => (day ? deriveNotifications(day) : []), [day]);

  const onPick = async (code: BankCode) => {
    // Append a new activity 30 min after the latest logged event (clamped); 0 if empty.
    const events = await getRepo().loadTimeline(DEMO_ORG_ID, ticketId);
    const maxAt = events.reduce((m, e) => Math.max(m, e.atMin), -30);
    const atMin = Math.max(0, Math.min(1440, maxAt + 30));
    // appendTimelineEvent requires `id` (only `seq` is auto-assigned). Client-side unique id is fine.
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ev-${atMin}-${code.code}-${events.length + 1}`;
    await getRepo().appendTimelineEvent({ id, orgId: DEMO_ORG_ID, ticketId, atMin, kind: 'activity', code: code.code });
    const view = await load();
    setDay(view ? timelineToRigDay(view) : null);
    setWarnings(view?.warnings ?? []);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Operate · Ticket time-view"
        title={day?.label ?? 'Ticket'}
        subtitle="The section's append-only activity timeline, rendered on the 24-hour rig-day axis. Log an activity from the Bank."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/tickets" className="inline-flex items-center gap-1 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground transition-colors hover:text-gold-light">
              <ArrowLeft className="h-3 w-3" /> Board
            </Link>
            {day && (
              <button type="button" onClick={() => setPaletteOpen(true)} className={BTN_CLASS}>
                <Search className="h-3.5 w-3.5" strokeWidth={2} /> Log activity
              </button>
            )}
          </div>
        }
      />

      {!loaded ? (
        <LoadingState />
      ) : !day ? (
        <EmptyState title="Ticket not found" description="No section with this id exists in the coded-object graph." />
      ) : (
        <div className="space-y-6">
          {warnings.length > 0 && (
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li key={`${w}-${i}`} className="rounded-md border border-red/20 bg-red/[0.06] px-3 py-2 text-xs text-red">{w}</li>
              ))}
            </ul>
          )}
          <Card><CardHeader><CardTitle>24-Hour Timeline</CardTitle></CardHeader><CardContent>
            <RigDayTimeline day={day} />
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Parties &amp; Equipment</CardTitle></CardHeader><CardContent>
            <RigDayLanes day={day} progress={progress} />
          </CardContent></Card>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {accounting && <Card><CardHeader><CardTitle>Time Accounting</CardTitle></CardHeader><CardContent><TimeAccountingRail accounting={accounting} /></CardContent></Card>}
            <Card><CardHeader><CardTitle>Notifications</CardTitle></CardHeader><CardContent><NotificationsPanel notifications={notifications} /></CardContent></Card>
          </div>
        </div>
      )}

      <BankSearchPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} codes={bankCodes} onSelect={onPick} />
    </div>
  );
}
```

(Confirm the shared imports — `PageHeader`, `Card*`, `LoadingState`/`EmptyState`, the four rig-day components — resolve to the real module paths; adjust if any differ. `deriveProgress` will return `[]` since timeline blocks carry no depth — `RigDayLanes` renders lanes without a depth curve, which is fine.)

- [ ] **Step 4: Run the component test, verify pass**

Run: `corepack pnpm --filter @valor/web test -- ticket-time-view` → PASS (2).

- [ ] **Step 5: Implement the route wrapper `apps/web/app/(hub)/tickets/[ticketId]/page.tsx`**

```tsx
import { objectsByType, DEFAULT_CODED_GRAPH } from '@valor/core';
import { TicketTimeView } from '@/components/ticket-time-view';

// Pre-render the seed section(s) on static export; the node repo graph is empty, so
// derive the params from the seed constant (matches the board's seed-fallback).
export async function generateStaticParams() {
  if (process.env.STATIC_EXPORT !== 'true') return [];
  return objectsByType(DEFAULT_CODED_GRAPH, 'section').map((s) => ({ ticketId: s.id }));
}

export default async function TicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return <TicketTimeView ticketId={ticketId} />;
}
```

- [ ] **Step 6: Verify typecheck + full web suite**

Run: `corepack pnpm --filter @valor/web test -- ticket-time-view` → PASS. `corepack pnpm --filter @valor/web typecheck` → 0. `corepack pnpm --filter @valor/web test` → all pass.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/(hub)/tickets/[ticketId]/page.tsx" apps/web/components/ticket-time-view.tsx apps/web/__tests__/ticket-time-view.test.tsx
git commit -m "feat(web): Ticket time-view — /tickets/[ticketId] renders the timeline via the rig-day visuals"
```

---

### Task 3: Verify — core suite, web, both builds, PR

**Files:** none (verification only)

- [ ] **Step 1: Full core + typecheck**

Run: `corepack pnpm --filter @valor/core test` → all pass. `corepack pnpm --filter @valor/core typecheck` → 0.

- [ ] **Step 2: Web typecheck + tests + normal build**

Run: `corepack pnpm --filter @valor/web typecheck` → 0. `corepack pnpm --filter @valor/web test` → all pass (+1 todo). `corepack pnpm --filter @valor/web build` → "Compiled successfully".

- [ ] **Step 3: Static-export build (PowerShell)**

```powershell
Remove-Item -Recurse -Force apps/web/.next, apps/web/out -ErrorAction SilentlyContinue
$env:STATIC_EXPORT='true'; $env:PAGES_BASE_PATH='ValorOperations_SB'
corepack pnpm --filter @valor/web build
```
Expected: a `/tickets/[ticketId]` route pre-rendered for the seed section (one more page than E1's 23), exit 0, `apps/web/out/tickets/sec-int-1/index.html` emitted. Then clear env: `Remove-Item Env:STATIC_EXPORT,Env:PAGES_BASE_PATH`.

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/ticket-board-e2
gh pr create --base master --head feat/ticket-board-e2 --title "feat: Rig-Day ticket time-view (architecture Slice E2 — completes the keystone)" --body-file <temp: summary + test plan>
```
Then run the standard dual-bot loop (CodeRabbit + Copilot), action-or-justify, re-review, merge.

---

## Self-Review

**1. Spec coverage (E2):**
- `timelineToRigDay` adapter (activity→blocks span-to-next; qc→covering block; parties/equipment→full-day lanes; depth absent) → Task 1 ✓
- `/tickets/[ticketId]` server wrapper + `generateStaticParams` (seed sections, STATIC_EXPORT-gated) → Task 2 Step 5 ✓
- Client time-view: load graph (seed-fallback) + timeline (seed-fallback), assemble, project, render the 4 reused rig-day components, derive accounting/notifications, not-found state, load-guard → Task 2 Step 3 ✓
- Append via palette (`appendTimelineEvent`, then reload) → `onPick` ✓
- Tests (adapter; view render + not-found) → Tasks 1 & 2 ✓
- Reuses rig-day components unchanged; RigDay storage untouched; depth deferred → confirmed ✓
- Both builds incl. static export of the seed ticket route → Task 3 ✓

**2. Placeholder scan:** none — full code in every step; commands have expected output. (Task 2 Step 3 flags confirming shared-import paths — a verification instruction; Task 3 Step 4 `--body-file` is the standard PR step.)

**3. Type consistency:** `RigDay`/`TimeBlock`/`LaneItem`/`TicketView`/`TimelineEvent`/`BankCode`/`TimeAccounting`/`Notification`/`ProgressPoint` are the real `@valor/core` exports; `timelineToRigDay`, `deriveTimeAccounting`/`deriveProgress`/`deriveNotifications`, `assembleTicket`/`objectsByType`, `DEFAULT_CODED_GRAPH`/`DEFAULT_TIMELINE`/`SEED_TICKET_ID`, `appendTimelineEvent`/`loadTimeline`/`loadCodedGraph`, the component props (`RigDayTimeline {day,onSelect?}`, `RigDayLanes {day,progress}`, `TimeAccountingRail {accounting}`, `NotificationsPanel {notifications}`), `BankSearchPalette {open,onClose,codes,onSelect?}`, and the route param `ticketId` match across tasks. The `onPick` append supplies a required `id` (a client-side `crypto.randomUUID()` with a deterministic fallback) and omits only `seq` (auto-assigned by the repo) — matching `appendTimelineEvent`'s `Omit<TimelineEvent,'seq'> & { seq?: number }` contract.
