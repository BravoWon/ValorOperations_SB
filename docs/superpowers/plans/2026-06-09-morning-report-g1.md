# Morning report (Slice G1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A printable per-day morning report (`/morning-report`, Visualize plane) assembled per section from the existing projections — time accounting, code tallies, flagged QC, the previously-unrendered `note`/`hse`/`milestone` journal, and notifications.

**Architecture:** One new pure core module (`report/morning-report.ts`: `deriveMorningReport(view, rules?): MorningReportSection`, conventions of `deriveTimeAccounting`/`deriveNotifications`) + a client report page that reuses the `/day` load pipeline (graph seed-fallback → per-section timeline → `assembleTicket`) and renders print-clean sections with a `window.print()` button — following the existing diagram-export precedent (`apps/web/lib/export-diagram.ts` `printDiagram()`, `.no-print` convention). No new storage; read-only.

**Tech Stack:** TypeScript, `@valor/core` (pure, Vitest node), `@valor/web` (Next 15 App Router, React 19, Tailwind, Vitest/jsdom). Spec: `docs/superpowers/specs/2026-06-09-handoff-morning-report-design.md` (G1 portion; G2 shift handoff is a separate later plan).

**Branch note:** `feat/morning-report` is created **off master after PR #26 (Slice F) merges**. The spec + this plan (untracked working-tree files) become the branch's first commit.

**Constraints:** No `Date.now`/`Math.random` in `@valor/core` (the "as-of" framing is data-derived, not clock-derived). `warnings: string[]`, never throw. Additive — no changes to existing projections/components; both typechecks 0; both builds pass (static export +1 page, `/morning-report`). MockRepository default; IP guardrail generic terms only.

Commands (run from the repository root):
- Core: `corepack pnpm --filter @valor/core test -- <name>` / `test` / `typecheck`
- Web: `corepack pnpm --filter @valor/web test -- <name>` / `test` / `typecheck` / `build`

Reference shapes (verbatim):
- `TicketView { section: CodedObject; parties: CodedObject[]; equipment: CodedObject[]; bha: CodedObject[]; timeline: TimelineEvent[]; warnings: string[] }`
- `TimelineEvent { id; orgId; ticketId; seq; atMin; kind: 'activity'|'note'|'qc'|'hse'|'milestone'; code?; note?; qc? }`; `EventQcMark { status: 'approved'|'flagged'; note? }`
- `TimeAccounting { totalLoggedMin; productiveMin; nptMin; byCode: CodeTally[]; unaccountedGaps: { startMin; endMin }[]; warnings }`; `CodeTally { code; label; category; minutes; npt; billable }`
- `deriveTimeAccounting(blocks, nowMin?)`, `deriveNotifications(rigDay, rules?)`, `timelineToRigDay(view)`, `findBankCode(code)`, `NotificationRules`/`DEFAULT_NOTIFICATION_RULES`, `Notification { id; severity; category; title; detail }`
- Print precedent: `apps/web/lib/export-diagram.ts` → `export function printDiagram(): void { window.print(); }`; `.no-print` used in the well-setup print styles.
- The `/day` page (`apps/web/app/(hub)/day/page.tsx`) is the load-pipeline template (seed-fallback, per-section Promise.all, failed/empty states).

---

## File Structure
- **Create `packages/core/src/report/morning-report.ts`** — `MorningReportSection` + pure `deriveMorningReport`.
- **Modify `packages/core/src/index.ts`** — `export * from './report/morning-report';`
- **Create `packages/core/test/morning-report.test.ts`**.
- **Create `apps/web/components/morning-report-view.tsx`** — presentational report (printable).
- **Create `apps/web/app/(hub)/morning-report/page.tsx`** — client page (load + derive + print button).
- **Modify `apps/web/lib/planes.ts`** + **`apps/web/__tests__/planes.test.ts`** — register `/morning-report`.
- **Test `apps/web/__tests__/morning-report-view.test.tsx`**.

---

### Task 1: Core — `deriveMorningReport` (TDD)

**Files:**
- Create: `packages/core/src/report/morning-report.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/morning-report.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/core/test/morning-report.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assembleTicket, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID, type TimelineEvent } from '../src/coded-object/graph';
import { deriveMorningReport } from '../src/report/morning-report';

const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
const ORG = DEFAULT_TIMELINE[0]!.orgId;

describe('deriveMorningReport', () => {
  it('summarizes the seed ticket (identity, accounting, crews)', () => {
    const r = deriveMorningReport(view);
    expect(r.ticketId).toBe(SEED_TICKET_ID);
    expect(r.sectionLabel).toBe('12¼" Intermediate');
    expect(r.code).toBe('DRL');
    expect(r.bankLabel).toBe('Drilling');
    expect(r.status).toBe('in_progress');
    // Blocks: TIH 0–120, DRL 120–510 (productive), RIGREP 510–1440 (NPT).
    expect(r.accounting.productiveMin).toBe(510);
    expect(r.accounting.nptMin).toBe(930);
    expect(r.accounting.byCode.length).toBe(3);
    expect(r.parties).toEqual(['Directional Driller', 'Mud Engineer']);
    expect(r.equipment).toEqual(['Rig', 'Triplex Pumps']);
  });

  it('collects flagged QC (not approved) with time + note', () => {
    const flagged: TimelineEvent[] = [
      ...DEFAULT_TIMELINE,
      { id: 'q2', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 5, atMin: 700, kind: 'qc', qc: { status: 'flagged', note: 'Re-check depth' } },
    ];
    const r = deriveMorningReport({ ...view, timeline: flagged });
    expect(r.flaggedQc).toEqual([{ atMin: 700, note: 'Re-check depth' }]);
    // The seed's approved qc (ev-4) must NOT appear.
    const base = deriveMorningReport(view);
    expect(base.flaggedQc).toEqual([]);
  });

  it('surfaces note/hse/milestone events as the journal, in seq order', () => {
    const withJournal: TimelineEvent[] = [
      ...DEFAULT_TIMELINE,
      { id: 'j1', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 5, atMin: 650, kind: 'note', note: 'Standby for weather' },
      { id: 'j2', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 6, atMin: 660, kind: 'hse', note: 'Toolbox talk held' },
      { id: 'j3', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 7, atMin: 700, kind: 'milestone', note: 'Shift handoff @ 11:40' },
    ];
    const r = deriveMorningReport({ ...view, timeline: withJournal });
    expect(r.journal.map((j) => j.kind)).toEqual(['note', 'hse', 'milestone']);
    expect(r.journal[0]).toEqual({ atMin: 650, kind: 'note', note: 'Standby for weather' });
  });

  it('passes through notifications and merges warnings; tolerates an empty timeline', () => {
    const r = deriveMorningReport(view);
    expect(Array.isArray(r.notifications)).toBe(true);
    expect(Array.isArray(r.warnings)).toBe(true);
    const empty = deriveMorningReport({ ...view, timeline: [] });
    expect(empty.accounting.totalLoggedMin).toBe(0);
    expect(empty.journal).toEqual([]);
    expect(empty.flaggedQc).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/core test -- morning-report`
Expected: FAIL — cannot resolve `../src/report/morning-report`.

- [ ] **Step 3: Create `packages/core/src/report/morning-report.ts`**

```ts
import { findBankCode } from '../well-setup/bank';
import type { TicketView } from '../coded-object/types';
import { timelineToRigDay } from '../coded-object/timeline-view';
import { deriveTimeAccounting } from '../rig-day/time-accounting';
import type { TimeAccounting } from '../rig-day/types';
import { deriveNotifications, DEFAULT_NOTIFICATION_RULES, type Notification, type NotificationRules } from '../notifications/notifications';

export interface MorningReportSection {
  ticketId: string;
  sectionLabel: string;
  code?: string;
  bankLabel?: string;
  status?: string;
  accounting: TimeAccounting;
  parties: string[];
  equipment: string[];
  flaggedQc: { atMin: number; note?: string }[];
  journal: { atMin: number; kind: 'note' | 'hse' | 'milestone'; note?: string }[];
  notifications: Notification[];
  warnings: string[];
}

/**
 * Derive a per-section morning-report summary from the assembled ticket. Pure/deterministic
 * (no clock — the report covers the ticket's logged day as-is). Never throws; issues
 * surface in `warnings` (assembleTicket warnings + time-accounting warnings, merged).
 */
export function deriveMorningReport(view: TicketView, rules: NotificationRules = DEFAULT_NOTIFICATION_RULES): MorningReportSection {
  const { section, parties, equipment, timeline, warnings: viewWarnings } = view;
  const day = timelineToRigDay(view);
  const accounting = deriveTimeAccounting(day.blocks);
  const notifications = deriveNotifications(day, rules);

  const bank = section.code ? findBankCode(section.code) : undefined;
  const statusRaw = section.fields.status;
  const status = statusRaw == null || statusRaw === '' ? undefined : String(statusRaw);

  const flaggedQc = timeline
    .filter((e) => e.kind === 'qc' && e.qc?.status === 'flagged')
    .map((e) => ({ atMin: e.atMin, ...(e.qc?.note ? { note: e.qc.note } : {}) }));

  const journal = timeline
    .filter((e): e is typeof e & { kind: 'note' | 'hse' | 'milestone' } => e.kind === 'note' || e.kind === 'hse' || e.kind === 'milestone')
    .map((e) => ({ atMin: e.atMin, kind: e.kind, ...(e.note ? { note: e.note } : {}) }));

  const label = (o: { label?: string; code?: string; id: string }) => o.label ?? o.code ?? o.id;

  return {
    ticketId: section.id,
    sectionLabel: section.label ?? section.code ?? section.id,
    code: section.code,
    bankLabel: bank?.label,
    status,
    accounting,
    parties: parties.map(label),
    equipment: equipment.map(label),
    flaggedQc,
    journal,
    notifications,
    warnings: [...viewWarnings, ...accounting.warnings],
  };
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`** — add with the other module exports:

```ts
export * from './report/morning-report';
```

- [ ] **Step 5: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/core test -- morning-report` → PASS (4). `corepack pnpm --filter @valor/core typecheck` → 0. `corepack pnpm --filter @valor/core test` → full suite green.
(Verify the seed-derived numbers in the first test against the real `deriveTimeAccounting` output — TIH 0–120 productive 120? NOTE: TIH is productive (npt:false) so productiveMin = TIH 120 + DRL 390 = 510, nptMin = RIGREP 930. If the actual derivation differs, fix the ASSERTIONS to the true values and report.)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/report/morning-report.ts packages/core/src/index.ts packages/core/test/morning-report.test.ts
git commit -m "feat(core): deriveMorningReport — per-section report summary from the graph projections"
```
End every commit body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 2: Web — report view + page + plane (TDD on the view)

**Files:**
- Create: `apps/web/components/morning-report-view.tsx`, `apps/web/app/(hub)/morning-report/page.tsx`
- Modify: `apps/web/lib/planes.ts`, `apps/web/__tests__/planes.test.ts`
- Test: `apps/web/__tests__/morning-report-view.test.tsx`

- [ ] **Step 1: Write the failing view test** — create `apps/web/__tests__/morning-report-view.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { assembleTicket, deriveMorningReport, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID } from '@valor/core';
import { MorningReportView } from '@/components/morning-report-view';

const section = deriveMorningReport(assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!);

describe('MorningReportView', () => {
  it('renders the section header, accounting line, and code tally', () => {
    const { getByText, getAllByTestId } = render(<MorningReportView sections={[section]} />);
    expect(getByText('12¼" Intermediate')).toBeTruthy();
    expect(getByText(/08:30/)).toBeTruthy(); // productive 510 min
    expect(getByText(/15:30/)).toBeTruthy(); // NPT 930 min
    expect(getAllByTestId('report-tally-row').length).toBe(3); // TIH, DRL, RIGREP
  });

  it('renders crews and an all-clear journal note when empty', () => {
    const { getByText } = render(<MorningReportView sections={[section]} />);
    expect(getByText(/Directional Driller/)).toBeTruthy();
    expect(getByText(/no journal entries/i)).toBeTruthy();
  });

  it('renders one report section per entry', () => {
    const { getAllByTestId } = render(<MorningReportView sections={[section, { ...section, ticketId: 's2', sectionLabel: 'Section Two' }]} />);
    expect(getAllByTestId('report-section').length).toBe(2);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/web test -- morning-report-view` → FAIL (cannot resolve component).

- [ ] **Step 3: Implement `apps/web/components/morning-report-view.tsx`**

```tsx
import { AlertTriangle, Flag } from 'lucide-react';
import type { MorningReportSection } from '@valor/core';

export interface MorningReportViewProps {
  sections: MorningReportSection[];
}

function fmtHm(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const KIND_LABEL: Record<'note' | 'hse' | 'milestone', string> = {
  note: 'Note',
  hse: 'HSE',
  milestone: 'Milestone',
};

/** Print-clean morning report: one block per section. Solid fills; no glassmorphism. */
export function MorningReportView({ sections }: MorningReportViewProps) {
  return (
    <div className="space-y-8">
      {sections.map((s) => (
        <section
          key={s.ticketId}
          data-testid="report-section"
          className="rounded-lg border border-gold/20 bg-background/40 p-5 print:break-inside-avoid print:border-black/20 print:bg-white"
        >
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.08] pb-2 print:border-black/10">
            <h2 className="font-display text-lg text-cream print:text-black">{s.sectionLabel}</h2>
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              {s.code}{s.bankLabel ? ` · ${s.bankLabel}` : ''}{s.status ? ` · ${s.status}` : ''}
            </span>
          </header>

          <div className="mb-3 flex flex-wrap gap-4 font-mono text-xs">
            <span className="text-green print:text-black">Productive {fmtHm(s.accounting.productiveMin)}</span>
            <span className={s.accounting.nptMin > 0 ? 'text-red' : 'text-muted-foreground'}>NPT {fmtHm(s.accounting.nptMin)}</span>
            <span className="text-muted-foreground">Logged {fmtHm(s.accounting.totalLoggedMin)}</span>
            <span className="text-muted-foreground">Gaps {s.accounting.unaccountedGaps.length}</span>
          </div>

          <table className="mb-3 w-full border-collapse text-xs">
            <thead>
              <tr>
                {['Code', 'Activity', 'Category', 'Time'].map((h) => (
                  <th key={h} className="pb-1 pr-3 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...s.accounting.byCode].sort((a, b) => b.minutes - a.minutes).map((t) => (
                <tr key={t.code} data-testid="report-tally-row" className="border-t border-white/[0.05] print:border-black/10">
                  <td className="py-1 pr-3 font-mono">{t.code}</td>
                  <td className="py-1 pr-3">{t.label}</td>
                  <td className="py-1 pr-3 text-muted-foreground">{t.category}</td>
                  <td className={`py-1 pr-3 font-mono ${t.npt ? 'text-red' : ''}`}>{fmtHm(t.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mb-3 font-mono text-xs text-muted-foreground">
            Crew: {s.parties.length ? s.parties.join(', ') : '—'} · Equipment: {s.equipment.length ? s.equipment.join(', ') : '—'}
          </div>

          {s.flaggedQc.length > 0 && (
            <ul className="mb-3 space-y-1">
              {s.flaggedQc.map((q, i) => (
                <li key={`${q.atMin}-${i}`} className="flex items-center gap-2 text-xs text-red">
                  <Flag className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                  QC flagged @ {fmtHm(q.atMin)}{q.note ? ` — ${q.note}` : ''}
                </li>
              ))}
            </ul>
          )}

          <div className="mb-3">
            <div className="mb-1 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">Journal</div>
            {s.journal.length > 0 ? (
              <ul className="space-y-1 text-xs">
                {s.journal.map((j, i) => (
                  <li key={`${j.atMin}-${i}`} className="flex items-start gap-2">
                    <span className="shrink-0 rounded border border-white/[0.08] px-1 font-mono text-[0.625rem] text-muted-foreground">{KIND_LABEL[j.kind]}</span>
                    <span className="font-mono text-muted-foreground">{fmtHm(j.atMin)}</span>
                    <span className="text-cream print:text-black">{j.note ?? '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-mono text-xs text-muted-foreground/60">No journal entries.</p>
            )}
          </div>

          {(s.notifications.length > 0 || s.warnings.length > 0) && (
            <ul className="space-y-1 text-xs">
              {s.notifications.map((n) => (
                <li key={n.id} className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                  {n.title} <span className="text-muted-foreground/60">{n.detail}</span>
                </li>
              ))}
              {s.warnings.map((w, i) => (
                <li key={`${w}-${i}`} className="text-red">{w}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the view test, verify pass**

Run: `corepack pnpm --filter @valor/web test -- morning-report-view` → PASS (3). (As in Task 1, if a derived total differs, correct the assertion to the true value.)

- [ ] **Step 5: Register the route** — in `apps/web/lib/planes.ts`, add `FileText` to the lucide import and add to the Visualize plane AFTER Operator's Day:

```ts
      { href: '/day', label: "Operator's Day", icon: CalendarClock, minRole: 'viewer' },
      { href: '/morning-report', label: 'Morning Report', icon: FileText, minRole: 'field' },
      { href: '/data-studio', label: 'Data Studio', icon: BarChart3, minRole: 'viewer' },
```

In `apps/web/__tests__/planes.test.ts`, insert `'/morning-report'` into `EXISTING_NAV` between `'/day'` and `'/data-studio'`.

- [ ] **Step 6: Implement `apps/web/app/(hub)/morning-report/page.tsx`** (the `/day` load pipeline + a Print action):

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import {
  assembleTicket,
  objectsByType,
  deriveMorningReport,
  DEFAULT_CODED_GRAPH,
  DEFAULT_TIMELINE,
  type CodedGraph,
  type TimelineEvent,
  type MorningReportSection,
} from '@valor/core';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { MorningReportView } from '@/components/morning-report-view';
import { LoadingState, EmptyState } from '@/components/ui/states';

const BTN_CLASS =
  'no-print flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

export default function MorningReportPage() {
  const [sections, setSections] = useState<MorningReportSection[]>([]);
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
      const secs = objectsByType(graph, 'section');
      const derived = await Promise.all(
        secs.map(async (section): Promise<MorningReportSection | null> => {
          let events: TimelineEvent[] = await repo.loadTimeline(DEMO_ORG_ID, section.id);
          if (events.length === 0 && usingSeed) events = DEFAULT_TIMELINE.filter((e) => e.ticketId === section.id);
          const view = assembleTicket(graph, events, section.id);
          return view ? deriveMorningReport(view) : null;
        }),
      );
      if (!active) return;
      setSections(derived.filter((s): s is MorningReportSection => s !== null));
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
        eyebrow="Visualize · Morning Report"
        title="Morning Report"
        subtitle="The day's coded record per section — time accounting, code tallies, QC flags, journal, and exceptions. Print-ready."
        actions={
          <button type="button" onClick={() => window.print()} disabled={!loaded || sections.length === 0} className={BTN_CLASS}>
            <Printer className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Print
          </button>
        }
      />
      {!loaded ? (
        <LoadingState />
      ) : failed ? (
        <EmptyState title="Couldn't load the report" description="The coded-object graph couldn't be read. Refresh to try again." />
      ) : sections.length > 0 ? (
        <MorningReportView sections={sections} />
      ) : (
        <EmptyState title="No active sections" description="Sections will appear here as they're added to the coded-object graph." />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verify**

Run: `corepack pnpm --filter @valor/web test -- "morning-report|planes"` → PASS. `corepack pnpm --filter @valor/web typecheck` → 0. `corepack pnpm --filter @valor/web test` → all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/morning-report-view.tsx "apps/web/app/(hub)/morning-report/page.tsx" apps/web/lib/planes.ts apps/web/__tests__/planes.test.ts apps/web/__tests__/morning-report-view.test.tsx
git commit -m "feat(web): Morning Report — printable per-section day report (Visualize plane)"
```

---

### Task 3: Verify — suites, both builds, PR

**Files:** none (verification only)

- [ ] **Step 1:** `corepack pnpm --filter @valor/core test` → all pass. `corepack pnpm --filter @valor/core typecheck` → 0.
- [ ] **Step 2:** `corepack pnpm --filter @valor/web typecheck` → 0. `corepack pnpm --filter @valor/web test` → all pass. `corepack pnpm --filter @valor/web build` → compiled.
- [ ] **Step 3: Static-export build (PowerShell):** the standard `STATIC_EXPORT='true'` build; expect one more page than the F build, `apps/web/out/morning-report/index.html` emitted; clear env after.
- [ ] **Step 4:** `git push -u origin feat/morning-report`; `gh pr create` (base master, title "feat: Morning Report — printable day report (architecture Slice G1)", body: summary + test plan); the standard dual-bot loop; merge.

---

## Self-Review

**1. Spec coverage (G1):** `deriveMorningReport` (identity/accounting/crews/flaggedQc/journal/notifications/merged warnings, conventions) → Task 1 ✓. Printable view (header, KPI line, tally table sorted by minutes, crews, QC flags, journal incl. empty state, notifications/warnings; print classes) → Task 2 Step 3 ✓. `/morning-report` route (Visualize after `/day`, `field`, FileText) + planes test → Task 2 Step 5 ✓. Page (the `/day` pipeline + window.print + `.no-print` on the button) → Task 2 Step 6 ✓. Tests (core ×4, view ×3, planes) → Tasks 1–2 ✓. Read-only, additive, static export +1 page → Task 3 ✓. (G2 handoff is deferred to its own plan per the spec.)

**2. Placeholder scan:** none — full code everywhere; the two derived-number notes instruct verifying assertions against real derivation (honest-test discipline), not gaps.

**3. Type consistency:** `MorningReportSection` fields match between core, the view props, and the page state. The journal kind union `'note'|'hse'|'milestone'` matches `EventKind` members; `flaggedQc` uses `{ atMin, note? }`; imports (`timelineToRigDay` from `../coded-object/timeline-view`, `deriveTimeAccounting` from `../rig-day/time-accounting`, `deriveNotifications`/`DEFAULT_NOTIFICATION_RULES` from `../notifications/notifications`) point at the real modules; `index.ts` gains exactly one export line.
