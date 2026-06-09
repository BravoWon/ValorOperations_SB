# Live "Operator's Day" board (Slice F) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only Visualization-plane board (`/day`) showing every active section's coded day as a compact row on one shared 24-hour axis, with aggregate KPIs and section-tagged notifications — the spine made visible.

**Architecture:** Web-only and additive (no core changes). The page mirrors the tickets-board load flow (graph seed-fallback → per-section timeline → `assembleTicket` → `timelineToRigDay`), derives `TimeAccounting`/`Notification[]` **per section** (never concatenating blocks across sections — parallel sections would trigger false overlap warnings), and renders a new compact `DayBoardRow` per section under one shared hour axis, plus KPI cards (per-section sums) and a severity-ordered, section-chipped notifications list. Rows link to the Slice-E2 ticket time-view.

**Tech Stack:** TypeScript, `@valor/web` (Next 15 App Router, React 19, Tailwind, Vitest/jsdom + @testing-library/react). `@valor/core` consumed as-is. Spec: `docs/superpowers/specs/2026-06-09-operators-day-board-design.md`.

**Branch note:** `feat/operators-day` is created **off master after PR #25 (Slice E2) merges**. The spec + this plan are currently untracked working-tree files; they become the branch's first commit.

**Constraints:** NO core changes (`timelineToRigDay`/`deriveTimeAccounting`/`deriveNotifications`/`Notification` as-is; the section tag is an app-layer wrapper). The rig-day components, `kpi-strip.tsx`, and `notifications-panel.tsx` are READ for conventions but NOT modified. Both typechecks 0; both web builds pass (static export +1 page, `/day`, no dynamic params). MockRepository stays default. IP guardrail: generic terms only.

Commands (run from the repository root):
- Web one: `corepack pnpm --filter @valor/web test -- <name>` · all: `corepack pnpm --filter @valor/web test` · typecheck: `corepack pnpm --filter @valor/web typecheck` · build: `corepack pnpm --filter @valor/web build`
- Core (verification only): `corepack pnpm --filter @valor/core test`

Reference conventions (verbatim from the codebase — reuse, do not modify the sources):
- `rig-day-timeline.tsx`: `CATEGORY_COLOR` hex map (`'Make Hole': '#C9A24B'`, `'Pipe Movement': '#4FA3C7'`, `'Casing/Cement': '#7D8BB0'`, `'Pressure/BOP': '#5B8C7A'`, `Evaluation: '#B08AC9'`, `'Trouble (NPT)': '#C0504D'`, `Service: '#9A8C6B'`), `FALLBACK_COLOR = '#52627E'`, `colorForCode` via `findBankCode(code)?.category`, `pct(min) = \`${(min / DAY_MINUTES) * 100}%\``, `hhmm` zero-padded, hour labels every 3h, gridlines `bg-white/[0.06]`.
- `kpi-strip.tsx`: `glass lift` cards, a `TONE` record (`text/ring/glow`), `data text-4xl` value + mono uppercase label, corner glow div, icon chip.
- `notifications-panel.tsx`: `SEV_STYLE` per severity (`critical` red / `warn` gold / `info` muted; icons `AlertOctagon`/`AlertTriangle`/`Info`), order `['critical','warn','info']`.
- `app/(hub)/tickets/page.tsx`: the load/seed-fallback/`failed`-state pattern to mirror.
- `ui/states.tsx`: `LoadingState`, `EmptyState { title, description }`.

---

## File Structure
- **Create `apps/web/components/day-board-row.tsx`** — one compact section row (gutter + 24h track).
- **Create `apps/web/components/operators-day-board.tsx`** — KPI cards + shared axis + rows + tagged notifications (exports `DayBoardEntry`).
- **Create `apps/web/app/(hub)/day/page.tsx`** — the client page (load + derive + render).
- **Modify `apps/web/lib/planes.ts`** + **`apps/web/__tests__/planes.test.ts`** — register `/day`.
- **Test** `apps/web/__tests__/day-board-row.test.tsx`, `apps/web/__tests__/operators-day-board.test.tsx`.

---

### Task 1: `DayBoardRow` (TDD)

**Files:**
- Create: `apps/web/components/day-board-row.tsx`
- Test: `apps/web/__tests__/day-board-row.test.tsx`

- [ ] **Step 1: Write the failing test** — create `apps/web/__tests__/day-board-row.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { RigDay } from '@valor/core';
import { DayBoardRow } from '@/components/day-board-row';

const day: RigDay = {
  id: 'sec-int-1',
  label: '12¼" Intermediate',
  blocks: [
    { id: 'b1', code: 'DRL', startMin: 0, endMin: 720 },
    { id: 'b2', code: 'RIGREP', startMin: 720, endMin: 1440 },
  ],
};

describe('DayBoardRow', () => {
  it('renders one positioned block per coded block', () => {
    const { getAllByTestId } = render(<DayBoardRow day={day} href="/tickets/sec-int-1" />);
    const blocks = getAllByTestId('day-board-block');
    expect(blocks.length).toBe(2);
    expect((blocks[0] as HTMLElement).style.left).toBe('0%');
    expect((blocks[0] as HTMLElement).style.width).toBe('50%');
  });

  it('links the whole row to the ticket time-view', () => {
    const { getByTestId } = render(<DayBoardRow day={day} href="/tickets/sec-int-1" />);
    const row = getByTestId('day-board-row') as HTMLAnchorElement;
    expect(row.getAttribute('href')).toBe('/tickets/sec-int-1');
    expect(row.getAttribute('aria-label')).toMatch(/12¼" Intermediate/);
  });

  it('shows the section label and block count in the gutter', () => {
    const { getByText } = render(<DayBoardRow day={day} href="/tickets/sec-int-1" />);
    expect(getByText('12¼" Intermediate')).toBeTruthy();
    expect(getByText(/2 blocks/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/web test -- day-board-row`
Expected: FAIL — cannot resolve `@/components/day-board-row`.

- [ ] **Step 3: Implement `apps/web/components/day-board-row.tsx`**

```tsx
import Link from 'next/link';
import { DAY_MINUTES, findBankCode, type RigDay } from '@valor/core';

export interface DayBoardRowProps {
  day: RigDay;
  href: string;
}

// Category tinting mirrors rig-day-timeline.tsx (the detail view owns the canonical map;
// kept local here because that component is intentionally not modified by this slice).
const CATEGORY_COLOR: Record<string, string> = {
  'Make Hole': '#C9A24B',
  'Pipe Movement': '#4FA3C7',
  'Casing/Cement': '#7D8BB0',
  'Pressure/BOP': '#5B8C7A',
  Evaluation: '#B08AC9',
  'Trouble (NPT)': '#C0504D',
  Service: '#9A8C6B',
};
const FALLBACK_COLOR = '#52627E';

function colorForCode(code: string): string {
  const bank = findBankCode(code);
  return bank ? (CATEGORY_COLOR[bank.category] ?? FALLBACK_COLOR) : FALLBACK_COLOR;
}

function pct(min: number): string {
  return `${(min / DAY_MINUTES) * 100}%`;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i);

/** One compact section row on the shared 24h axis. Read-only; the row links to the ticket. */
export function DayBoardRow({ day, href }: DayBoardRowProps) {
  return (
    <Link
      href={href}
      data-testid="day-board-row"
      aria-label={`Open ${day.label} timeline`}
      className="group flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-white/[0.03]"
    >
      <div className="w-40 shrink-0">
        <div className="truncate font-mono text-xs text-cream group-hover:text-gold-light">{day.label}</div>
        <div className="font-mono text-[0.625rem] text-muted-foreground/60">{day.blocks.length} blocks</div>
      </div>
      <div className="relative h-8 flex-1 overflow-hidden rounded-md border border-gold/15 bg-background/40">
        {HOURS.map((h) => (
          <div
            key={`grid-${h}`}
            className="pointer-events-none absolute inset-y-0 w-px bg-white/[0.06]"
            style={{ left: pct(h * 60) }}
            aria-hidden="true"
          />
        ))}
        {day.blocks.map((b) => (
          <div
            key={b.id}
            data-testid="day-board-block"
            title={`${b.code} ${b.startMin}–${b.endMin} min`}
            className="absolute inset-y-1 rounded-[2px]"
            style={{ left: pct(b.startMin), width: pct(Math.max(0, b.endMin - b.startMin)), backgroundColor: colorForCode(b.code) }}
          />
        ))}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `corepack pnpm --filter @valor/web test -- day-board-row` → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/day-board-row.tsx apps/web/__tests__/day-board-row.test.tsx
git commit -m "feat(web): DayBoardRow — compact section row on the shared 24h axis"
```
End every commit body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 2: `OperatorsDayBoard` (TDD)

**Files:**
- Create: `apps/web/components/operators-day-board.tsx`
- Test: `apps/web/__tests__/operators-day-board.test.tsx`

- [ ] **Step 1: Write the failing test** — create `apps/web/__tests__/operators-day-board.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { deriveTimeAccounting, type RigDay, type Notification } from '@valor/core';
import { OperatorsDayBoard, type DayBoardEntry } from '@/components/operators-day-board';

// DRL is productive; RIGREP is NPT (both in BANK_SEED).
const dayA: RigDay = { id: 's1', label: 'Section A', blocks: [{ id: 'a1', code: 'DRL', startMin: 0, endMin: 120 }] };
const dayB: RigDay = { id: 's2', label: 'Section B', blocks: [{ id: 'b1', code: 'RIGREP', startMin: 0, endMin: 60 }] };
const note: Notification = { id: 'n1', severity: 'warn', category: 'gap', title: 'Unaccounted 0:45 gap', detail: '01:00–01:45' };

const entries: DayBoardEntry[] = [
  { day: dayA, accounting: deriveTimeAccounting(dayA.blocks), notifications: [], sectionLabel: 'Section A', href: '/tickets/s1' },
  { day: dayB, accounting: deriveTimeAccounting(dayB.blocks), notifications: [note], sectionLabel: 'Section B', href: '/tickets/s2' },
];

describe('OperatorsDayBoard', () => {
  it('renders one row per entry', () => {
    const { getAllByTestId } = render(<OperatorsDayBoard rows={entries} />);
    expect(getAllByTestId('day-board-row').length).toBe(2);
  });

  it('shows aggregate KPIs summed per section (productive 02:00, NPT 01:00, 2 active)', () => {
    const { getByText } = render(<OperatorsDayBoard rows={entries} />);
    expect(getByText('02:00')).toBeTruthy(); // total productive (DRL 120 min)
    expect(getByText('01:00')).toBeTruthy(); // total NPT (RIGREP 60 min)
    expect(getByText(/active sections/i)).toBeTruthy();
  });

  it('renders notifications tagged with their section', () => {
    const { getByText } = render(<OperatorsDayBoard rows={entries} />);
    expect(getByText(/Unaccounted 0:45 gap/)).toBeTruthy();
    expect(getByText('Section B')).toBeTruthy(); // the section chip (also in the row gutter — assert the notification block contains it via the chip's testid below if ambiguous)
  });
});
```

(If `getByText('Section B')` is ambiguous because the row gutter also shows it, use `getAllByText('Section B')` and assert `length >= 2`, or query within a `data-testid="day-notification"` element — the implementation gives each notification item that testid.)

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/web test -- operators-day-board` → FAIL (cannot resolve component).

- [ ] **Step 3: Implement `apps/web/components/operators-day-board.tsx`**

```tsx
import { Activity, AlertOctagon, AlertTriangle, Flame, Info, type LucideIcon } from 'lucide-react';
import { DAY_MINUTES, type Notification, type NotificationSeverity, type RigDay, type TimeAccounting } from '@valor/core';
import { DayBoardRow } from '@/components/day-board-row';

export interface DayBoardEntry {
  day: RigDay;
  accounting: TimeAccounting;
  notifications: Notification[];
  sectionLabel: string;
  href: string;
}

export interface OperatorsDayBoardProps {
  rows: DayBoardEntry[];
}

function fmtHm(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function pct(min: number): string {
  return `${(min / DAY_MINUTES) * 100}%`;
}

const HOURS = Array.from({ length: 25 }, (_, i) => i);

type Tone = 'gold' | 'green' | 'cyan' | 'red';
const TONE: Record<Tone, { text: string; ring: string; glow: string }> = {
  gold: { text: 'text-gold', ring: 'border-gold/30 bg-gold/10', glow: 'from-gold/[0.12]' },
  green: { text: 'text-green', ring: 'border-green/30 bg-green/10', glow: 'from-green/[0.1]' },
  cyan: { text: 'text-cyan', ring: 'border-cyan/30 bg-cyan/10', glow: 'from-cyan/[0.1]' },
  red: { text: 'text-red', ring: 'border-red/30 bg-red/10', glow: 'from-red/[0.1]' },
};

// Severity conventions mirror notifications-panel.tsx (panel not modified by this slice).
const SEV: Record<NotificationSeverity, { row: string; icon: LucideIcon; text: string }> = {
  critical: { row: 'border-red/25 bg-red/[0.06]', icon: AlertOctagon, text: 'text-red' },
  warn: { row: 'border-gold/25 bg-gold/[0.05]', icon: AlertTriangle, text: 'text-gold-light' },
  info: { row: 'border-white/10 bg-white/[0.04]', icon: Info, text: 'text-muted-foreground' },
};
const SEV_ORDER: NotificationSeverity[] = ['critical', 'warn', 'info'];

/** The whole-day spine: KPI roll-up + every section's day on one shared 24h axis. */
export function OperatorsDayBoard({ rows }: OperatorsDayBoardProps) {
  const productiveMin = rows.reduce((s, r) => s + r.accounting.productiveMin, 0);
  const nptMin = rows.reduce((s, r) => s + r.accounting.nptMin, 0);

  const cards: { label: string; value: string; tone: Tone; icon: LucideIcon }[] = [
    { label: 'Productive', value: fmtHm(productiveMin), tone: 'green', icon: Flame },
    { label: 'NPT', value: fmtHm(nptMin), tone: nptMin > 0 ? 'red' : 'gold', icon: AlertTriangle },
    { label: 'Active sections', value: String(rows.length).padStart(2, '0'), tone: 'cyan', icon: Activity },
  ];

  const tagged = rows
    .flatMap((r) => r.notifications.map((n) => ({ ...n, sectionLabel: r.sectionLabel, key: `${r.day.id}-${n.id}` })))
    .sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));

  return (
    <div className="space-y-6">
      {/* Aggregate KPI cards (per-section sums — never concatenated blocks). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => {
          const tone = TONE[c.tone];
          const Icon = c.icon;
          return (
            <div key={c.label} className="glass lift relative overflow-hidden rounded-lg p-5">
              <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tone.glow} to-transparent blur-2xl`} />
              <div className="relative flex items-start justify-between">
                <div>
                  <div className="data text-4xl font-semibold leading-none text-cream">{c.value}</div>
                  <div className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">{c.label}</div>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-md border ${tone.ring}`}>
                  <Icon className={`h-4 w-4 ${tone.text}`} strokeWidth={1.75} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared hour axis (once), offset by the row gutter width + gap. */}
      <div>
        <div className="mb-1 flex items-center gap-3">
          <div className="w-40 shrink-0" />
          <div className="relative h-4 flex-1">
            {HOURS.filter((h) => h % 3 === 0).map((h) => (
              <span
                key={`axis-${h}`}
                className="absolute top-0 -translate-x-1/2 font-mono text-[0.625rem] text-muted-foreground/60"
                style={{ left: pct(h * 60) }}
              >
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          {rows.map((r) => (
            <DayBoardRow key={r.day.id} day={r.day} href={r.href} />
          ))}
        </div>
      </div>

      {/* Section-tagged notifications, severity-ordered. */}
      {tagged.length > 0 ? (
        <ul className="space-y-1.5">
          {tagged.map((n) => {
            const sev = SEV[n.severity];
            const Icon = sev.icon;
            return (
              <li key={n.key} data-testid="day-notification" className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${sev.row}`}>
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${sev.text}`} strokeWidth={2} aria-hidden="true" />
                <span className="flex-1">
                  <span className="text-cream">{n.title}</span>
                  <span className="ml-2 text-muted-foreground/70">{n.detail}</span>
                </span>
                <span className="shrink-0 rounded-md border border-white/[0.08] bg-background/40 px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
                  {n.sectionLabel}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="font-mono text-xs text-muted-foreground/60">All clear — no exceptions across active sections.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `corepack pnpm --filter @valor/web test -- operators-day-board` → PASS (3). (If the `Section B` text query is ambiguous against the row gutter, adjust the test per the note in Step 1.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/operators-day-board.tsx apps/web/__tests__/operators-day-board.test.tsx
git commit -m "feat(web): OperatorsDayBoard — KPI roll-up + shared-axis rows + tagged notifications"
```

---

### Task 3: `/day` page + plane registration

**Files:**
- Create: `apps/web/app/(hub)/day/page.tsx`
- Modify: `apps/web/lib/planes.ts`, `apps/web/__tests__/planes.test.ts`

- [ ] **Step 1: Register the route** — in `apps/web/lib/planes.ts`, add `CalendarClock` to the `lucide-react` import, then add as the FIRST Visualize item:

```ts
  {
    id: 'visualize', label: 'Visualize', icon: Eye,
    items: [
      { href: '/day', label: "Operator's Day", icon: CalendarClock, minRole: 'viewer' },
      { href: '/data-studio', label: 'Data Studio', icon: BarChart3, minRole: 'viewer' },
      ...
```

In `apps/web/__tests__/planes.test.ts`, insert `'/day'` into `EXISTING_NAV` immediately before `'/data-studio'`.

- [ ] **Step 2: Implement `apps/web/app/(hub)/day/page.tsx`** (mirror the tickets-board pattern exactly — read `app/(hub)/tickets/page.tsx` first and match the load/guard/failed conventions):

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  assembleTicket,
  objectsByType,
  timelineToRigDay,
  deriveTimeAccounting,
  deriveNotifications,
  DEFAULT_CODED_GRAPH,
  DEFAULT_TIMELINE,
  type CodedGraph,
  type TimelineEvent,
} from '@valor/core';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { OperatorsDayBoard, type DayBoardEntry } from '@/components/operators-day-board';
import { LoadingState, EmptyState } from '@/components/ui/states';

export default function OperatorsDayPage() {
  const [rows, setRows] = useState<DayBoardEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const repo = getRepo();
      let graph: CodedGraph = await repo.loadCodedGraph(DEMO_ORG_ID);
      let usingSeed = false;
      if (objectsByType(graph, 'section').length === 0) {
        graph = DEFAULT_CODED_GRAPH;
        usingSeed = true;
      }
      const sections = objectsByType(graph, 'section');
      const entries = await Promise.all(
        sections.map(async (section): Promise<DayBoardEntry | null> => {
          let events: TimelineEvent[] = await repo.loadTimeline(DEMO_ORG_ID, section.id);
          if (events.length === 0 && usingSeed) events = DEFAULT_TIMELINE.filter((e) => e.ticketId === section.id);
          const view = assembleTicket(graph, events, section.id);
          if (!view) return null;
          const day = timelineToRigDay(view);
          // Derive PER SECTION — concatenating blocks across parallel sections would
          // manufacture false overlap warnings.
          return {
            day,
            accounting: deriveTimeAccounting(day.blocks),
            notifications: deriveNotifications(day),
            sectionLabel: day.label,
            href: `/tickets/${day.id}`,
          };
        }),
      );
      if (!active) return;
      setRows(entries.filter((e): e is DayBoardEntry => e !== null));
      setLoaded(true);
    })().catch(() => {
      if (active) { setFailed(true); setLoaded(true); }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Visualize · Operator's Day"
        title="Operator's Day"
        subtitle="Every active section's coded day, time-aligned on one 24-hour axis — the operational spine at a glance. Click a row to open its ticket timeline."
      />
      {!loaded ? (
        <LoadingState />
      ) : failed ? (
        <EmptyState title="Couldn't load the day board" description="The coded-object graph couldn't be read. Refresh to try again." />
      ) : rows.length > 0 ? (
        <OperatorsDayBoard rows={rows} />
      ) : (
        <EmptyState title="No active sections" description="Sections will appear here as they're added to the coded-object graph." />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `corepack pnpm --filter @valor/web test -- planes` → PASS. `corepack pnpm --filter @valor/web typecheck` → 0. `corepack pnpm --filter @valor/web test` → all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/planes.ts apps/web/__tests__/planes.test.ts "apps/web/app/(hub)/day/page.tsx"
git commit -m "feat(web): Operator's Day board — /day route over the coded graph (Visualize plane)"
```

---

### Task 4: Verify — suites, both builds, PR

**Files:** none (verification only)

- [ ] **Step 1:** `corepack pnpm --filter @valor/core test` → all pass (untouched — same count as the E2 merge). `corepack pnpm --filter @valor/core typecheck` → 0.

- [ ] **Step 2:** `corepack pnpm --filter @valor/web typecheck` → 0. `corepack pnpm --filter @valor/web test` → all pass (+1 todo). `corepack pnpm --filter @valor/web build` → "Compiled successfully".

- [ ] **Step 3: Static-export build (PowerShell)**

```powershell
Remove-Item -Recurse -Force apps/web/.next, apps/web/out -ErrorAction SilentlyContinue
$env:STATIC_EXPORT='true'; $env:PAGES_BASE_PATH='ValorOperations_SB'
corepack pnpm --filter @valor/web build
```
Expected: one more static page than the E2 build (the new `/day`), exit 0, `apps/web/out/day/index.html` emitted. Then clear env: `Remove-Item Env:STATIC_EXPORT,Env:PAGES_BASE_PATH`.

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/operators-day
gh pr create --base master --head feat/operators-day --title "feat: live Operator's Day board (architecture Slice F)" --body-file <temp: summary + test plan>
```
Then the standard dual-bot loop (CodeRabbit + Copilot), action-or-justify, re-review, merge.

---

## Self-Review

**1. Spec coverage:**
- `/day` Visualize route, viewer, first item + planes test → Task 3 ✓
- `DayBoardRow` (gutter, h-8 track, gridlines, category-tinted read-only blocks, Link, aria, testid) → Task 1 ✓
- `OperatorsDayBoard` (KPI cards w/ per-section sums incl. red NPT tone, shared axis once w/ gutter offset, stacked rows, severity-ordered section-tagged notifications, fmtHm) → Task 2 ✓
- Page (seed-fallback, per-section derive — never concatenated, failed vs empty states, active guard, hrefs to `/tickets/[id]`) → Task 3 ✓
- Tests (row, board incl. honest `deriveTimeAccounting` fixtures, planes) → Tasks 1–3 ✓
- No core changes; reference components unmodified; static export +1 page → Tasks 1–4 ✓

**2. Placeholder scan:** none — full code in every step. (Task 4 Step 4 `--body-file` is the standard PR step; the Step-1 ambiguity note in Task 2 prescribes the exact fallback query.)

**3. Type consistency:** `DayBoardEntry { day; accounting; notifications; sectionLabel; href }` matches between the component export, the page construction, and the board test. `DayBoardRow { day; href }`, testids `day-board-row`/`day-board-block`/`day-notification`, `fmtHm`/`pct`/`HOURS`/`TONE`/`SEV` are internally consistent. All core imports (`timelineToRigDay`, `deriveTimeAccounting`, `deriveNotifications`, `assembleTicket`, `objectsByType`, seeds, `RigDay`/`TimeAccounting`/`Notification`/`NotificationSeverity`/`TimelineEvent`/`CodedGraph`, `DAY_MINUTES`, `findBankCode`) are real `@valor/core` exports.
