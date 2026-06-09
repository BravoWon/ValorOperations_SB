# Ticket board + Bank palette (Slice E1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the coded-object graph as the operator's work queue — a `/tickets` board of section cards (assembled via `assembleTicket` + a pure `summarizeTicket`) plus a global Cmd/Ctrl-K "search the Bank" command palette.

**Architecture:** Additive, read-only over the seed graph. A pure `summarizeTicket` in `@valor/core`; a client `/tickets` page that loads `loadCodedGraph` (falling back to `DEFAULT_CODED_GRAPH`/`DEFAULT_TIMELINE` when the repo graph has no sections) and renders `TicketCard`s; a `BankSearchPalette` modal wired into the app shell via a global Cmd-K handler. The E2 Rig-Day time-view (`/tickets/[ticketId]`) is a separate later plan; the card's "View timeline" link points at it.

**Tech Stack:** TypeScript, `@valor/core` (pure, Vitest node), `@valor/web` (Next 15 App Router, React 19, Tailwind, Vitest/jsdom + @testing-library/react). Branch: `feat/ticket-board` (already created). Spec: `docs/superpowers/specs/2026-06-09-ticket-board-design.md`.

**Constraints:** No `Date.now`/`Math.random` in `@valor/core`. Additive — existing tests + `/rig-day` + `/jobs` untouched; both typechecks 0; both web builds (normal + static export) pass. MockRepository stays default. IP guardrail: generic terms only.

> **Post-review deviations (as-built, PR #24).** Code blocks below are the original pre-implementation recipe; refinements landed during dual-bot review and are the source of truth in the merged code:
> 1. **`summarizeTicket` tidy** — uses `section.fields.status` (not `?.`; the field map is non-optional), the `== null` idiom, and resolves the latest activity's Bank label once. A 4th test (`'treats an empty-string status as undefined'`) was added.
> 2. **Board load-error state** — `tickets/page.tsx` adds a `failed` state: a load rejection renders a "Couldn't load tickets" error (distinct from the genuinely-empty "No tickets yet"), rather than silently showing empty.
> 3. **Palette** — the empty message reads "The Bank is empty." when no query is typed (vs `No codes match ""`), the dialog `aria-label` is "Bank search palette" (input keeps "Search the Bank" — no a11y-label collision), and Escape closes from anywhere in the modal (handler on the dialog container, not just the input).

Commands (run from the repository root):
- Core: `corepack pnpm --filter @valor/core test -- <name>` / `test` / `typecheck`
- Web: `corepack pnpm --filter @valor/web test -- <name>` / `test` / `typecheck` / `build`

Reference shapes (already in `@valor/core`): `TicketView { section: CodedObject; parties: CodedObject[]; equipment: CodedObject[]; bha: CodedObject[]; timeline: TimelineEvent[]; warnings: string[] }`; `CodedObject { id; orgId; type; code?; label?; fields: Record<string,FieldValue> }`; `TimelineEvent { id; orgId; ticketId; seq; atMin; kind; code?; note?; qc? }`; `assembleTicket(graph, events, ticketId)`, `objectsByType(graph, type)`, `DEFAULT_CODED_GRAPH`, `DEFAULT_TIMELINE`, `SEED_TICKET_ID`, `findBankCode(code)`.

---

## File Structure
- **Create `packages/core/src/coded-object/summary.ts`** — pure `summarizeTicket` + `TicketSummary` type.
- **Modify `packages/core/src/coded-object/graph.ts`** — re-export `./summary` (one line) so it's surfaced via the existing `export * from './coded-object/graph'`.
- **Create `packages/core/test/coded-object-summary.test.ts`**.
- **Modify `apps/web/lib/planes.ts`** — register `/tickets`. **Modify `apps/web/__tests__/planes.test.ts`** — EXISTING_NAV.
- **Create `apps/web/components/ticket-card.tsx`**, **`apps/web/components/bank-search-palette.tsx`**, **`apps/web/app/(hub)/tickets/page.tsx`**.
- **Modify `apps/web/components/app-shell.tsx`** — global Cmd-K + palette.
- **Test** `apps/web/__tests__/ticket-card.test.tsx`, `apps/web/__tests__/bank-search-palette.test.tsx`.

---

### Task 1: Core — `summarizeTicket`

**Files:**
- Create: `packages/core/src/coded-object/summary.ts`
- Modify: `packages/core/src/coded-object/graph.ts`
- Test: `packages/core/test/coded-object-summary.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/core/test/coded-object-summary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assembleTicket, summarizeTicket, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID } from '../src/coded-object/graph';

describe('summarizeTicket', () => {
  it('summarizes the seed ticket', () => {
    const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
    const s = summarizeTicket(view);
    expect(s.id).toBe(SEED_TICKET_ID);
    expect(s.label).toBe('12¼" Intermediate');
    expect(s.code).toBe('DRL');
    expect(s.bankLabel).toBe('Drilling');
    expect(s.category).toBe('Make Hole');
    expect(s.status).toBe('in_progress');
    expect(s.parties).toBe(2);
    expect(s.equipment).toBe(2);
    expect(s.bha).toBe(1);
    expect(s.timelineCount).toBe(4);
    // ev-4 is a qc event; the latest ACTIVITY is ev-3 RIGREP @ 510.
    expect(s.latestActivity?.code).toBe('RIGREP');
    expect(s.latestActivity?.atMin).toBe(510);
    expect(s.latestActivity?.bankLabel).toBe('Rig Repair');
    expect(s.warningCount).toBe(0);
  });

  it('tolerates an unknown section code (no bankLabel) and missing status', () => {
    const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
    const s = summarizeTicket({ ...view, section: { ...view.section, code: 'ZZZ', fields: {} } });
    expect(s.code).toBe('ZZZ');
    expect(s.bankLabel).toBeUndefined();
    expect(s.status).toBeUndefined();
  });

  it('handles a timeline with no activity events (no latestActivity)', () => {
    const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
    const s = summarizeTicket({ ...view, timeline: view.timeline.filter((e) => e.kind !== 'activity') });
    expect(s.latestActivity).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/core test -- coded-object-summary`
Expected: FAIL — `summarizeTicket` not exported.

- [ ] **Step 3: Create `packages/core/src/coded-object/summary.ts`**

```ts
import { findBankCode } from '../well-setup/bank';
import type { TicketView } from './types';

export interface TicketSummary {
  id: string;
  label?: string;
  code?: string;
  bankLabel?: string;
  category?: string;
  status?: string;
  parties: number;
  equipment: number;
  bha: number;
  timelineCount: number;
  latestActivity?: { code?: string; atMin: number; bankLabel?: string };
  warningCount: number;
}

/** Pure, deterministic projection of a TicketView into a card-friendly summary. */
export function summarizeTicket(view: TicketView): TicketSummary {
  const { section, parties, equipment, bha, timeline, warnings } = view;
  const bank = section.code ? findBankCode(section.code) : undefined;

  const statusRaw = section.fields?.status;
  const status = statusRaw === undefined || statusRaw === null || statusRaw === '' ? undefined : String(statusRaw);

  // Latest activity = the highest-seq event of kind 'activity' (timeline is seq-ordered).
  let latestActivity: TicketSummary['latestActivity'];
  for (const e of timeline) {
    if (e.kind === 'activity') {
      latestActivity = { code: e.code, atMin: e.atMin, bankLabel: e.code ? findBankCode(e.code)?.label : undefined };
    }
  }

  return {
    id: section.id,
    label: section.label,
    code: section.code,
    bankLabel: bank?.label,
    category: bank?.category,
    status,
    parties: parties.length,
    equipment: equipment.length,
    bha: bha.length,
    timelineCount: timeline.length,
    latestActivity,
    warningCount: warnings.length,
  };
}
```

- [ ] **Step 4: Re-export from `graph.ts`** — add this line in `packages/core/src/coded-object/graph.ts` next to the existing `export * from './types';` / seed re-export lines:

```ts
export * from './summary';
```

(`graph.ts` is already surfaced by `export * from './coded-object/graph'` in `index.ts`, so `summarizeTicket`/`TicketSummary` become part of `@valor/core` with no index change.)

- [ ] **Step 5: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/core test -- coded-object-summary` → PASS (3). `corepack pnpm --filter @valor/core typecheck` → 0. Also `corepack pnpm --filter @valor/core test` → full suite green.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/coded-object/summary.ts packages/core/src/coded-object/graph.ts packages/core/test/coded-object-summary.test.ts
git commit -m "feat(core): summarizeTicket — pure TicketView → card summary"
```
End every commit body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 2: Web — `/tickets` route, `TicketCard`, board page

**Files:**
- Modify: `apps/web/lib/planes.ts`, `apps/web/__tests__/planes.test.ts`
- Create: `apps/web/components/ticket-card.tsx`, `apps/web/app/(hub)/tickets/page.tsx`
- Test: `apps/web/__tests__/ticket-card.test.tsx`

- [ ] **Step 1: Register the route** in `apps/web/lib/planes.ts`

Add `ClipboardList` to the `lucide-react` import (the line importing the Operate icons `LayoutDashboard, Activity, Clock, Layers, ...`). Add to the Operate plane `items`, after `/jobs`:

```ts
      { href: '/jobs', label: 'Active Jobs', icon: Activity, minRole: 'field' },
      { href: '/tickets', label: 'Tickets', icon: ClipboardList, minRole: 'field' },
      { href: '/rig-day', label: 'Rig Day', icon: Clock, minRole: 'ops' },
```

In `apps/web/__tests__/planes.test.ts`, add `'/tickets'` to the `EXISTING_NAV` array, positioned after `'/jobs'`.

- [ ] **Step 2: Write the failing `TicketCard` test** — create `apps/web/__tests__/ticket-card.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { TicketSummary } from '@valor/core';
import { TicketCard } from '@/components/ticket-card';

const base: TicketSummary = {
  id: 'sec-int-1', label: '12¼" Intermediate', code: 'DRL', bankLabel: 'Drilling', category: 'Make Hole',
  status: 'in_progress', parties: 2, equipment: 2, bha: 1, timelineCount: 4,
  latestActivity: { code: 'RIGREP', atMin: 510, bankLabel: 'Rig Repair' }, warningCount: 0,
};

describe('TicketCard', () => {
  it('renders the label, code and counts', () => {
    const { getByText, getByTestId } = render(<TicketCard summary={base} />);
    expect(getByTestId('ticket-card')).toBeTruthy();
    expect(getByText('12¼" Intermediate')).toBeTruthy();
    expect(getByText(/DRL/)).toBeTruthy();
    expect(getByText(/4 events/i)).toBeTruthy();
  });

  it('shows a warning indicator when warningCount > 0', () => {
    const { queryByLabelText, rerender } = render(<TicketCard summary={base} />);
    expect(queryByLabelText(/warning/i)).toBeNull();
    rerender(<TicketCard summary={{ ...base, warningCount: 2 }} />);
    expect(queryByLabelText(/warning/i)).toBeTruthy();
  });

  it('links to the ticket timeline detail', () => {
    const { getByRole } = render(<TicketCard summary={base} />);
    const link = getByRole('link', { name: /view timeline/i }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/tickets/sec-int-1');
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `corepack pnpm --filter @valor/web test -- ticket-card` → FAIL (cannot resolve `@/components/ticket-card`).

- [ ] **Step 4: Implement `apps/web/components/ticket-card.tsx`**

```tsx
import Link from 'next/link';
import { AlertTriangle, Users, Wrench, Clock } from 'lucide-react';
import type { TicketSummary } from '@valor/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface TicketCardProps {
  summary: TicketSummary;
}

/** Category → accent class for the code chip (falls back to gold). */
const CATEGORY_ACCENT: Record<string, string> = {
  'Make Hole': 'border-gold/30 bg-gold/[0.08] text-gold-light',
  'Pipe Movement': 'border-cyan/30 bg-cyan/[0.08] text-cyan',
  'Casing/Cement': 'border-white/15 bg-white/[0.06] text-cream',
  'Pressure/BOP': 'border-cyan/30 bg-cyan/[0.08] text-cyan',
  'Evaluation': 'border-gold/30 bg-gold/[0.08] text-gold-light',
  'Trouble (NPT)': 'border-red/30 bg-red/[0.08] text-red',
  'Service': 'border-white/15 bg-white/[0.06] text-cream',
};

function fmtHm(atMin: number): string {
  const h = Math.floor(atMin / 60);
  const m = atMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function TicketCard({ summary }: TicketCardProps) {
  const accent = (summary.category && CATEGORY_ACCENT[summary.category]) || 'border-gold/30 bg-gold/[0.08] text-gold-light';
  return (
    <Card data-testid="ticket-card" className="flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="text-sm">{summary.label || '(unnamed)'}</CardTitle>
        {summary.code && (
          <span className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[0.625rem] ${accent}`}>
            {summary.code}{summary.bankLabel ? ` · ${summary.bankLabel}` : ''}
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 text-xs text-muted-foreground">
        {summary.status && (
          <span className="w-fit rounded-md border border-white/[0.08] bg-background/40 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-cream/80">
            {summary.status}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-3 font-mono text-[0.6875rem]">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden="true" />{summary.parties}</span>
          <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" aria-hidden="true" />{summary.equipment}</span>
          <span>{summary.bha} BHA</span>
        </div>
        <div className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem]">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {summary.timelineCount} events
          {summary.latestActivity && (
            <span className="text-muted-foreground/70">
              · latest {summary.latestActivity.code ?? '—'} @ {fmtHm(summary.latestActivity.atMin)}
            </span>
          )}
        </div>
        {summary.warningCount > 0 && (
          <span aria-label={`${summary.warningCount} warning(s)`} className="inline-flex w-fit items-center gap-1 rounded-md border border-red/20 bg-red/[0.06] px-2 py-0.5 text-[0.6875rem] text-red">
            <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
            {summary.warningCount}
          </span>
        )}
        <Link
          href={`/tickets/${summary.id}`}
          className="mt-auto inline-flex w-fit items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
        >
          View timeline
        </Link>
      </CardContent>
    </Card>
  );
}
```

(Note: the `/tickets/[ticketId]` target is delivered in Slice E2; the link is intentional forward-wiring. The `cyan` token is used elsewhere in rig-day visuals; if a class doesn't exist it degrades to no color — acceptable.)

- [ ] **Step 5: Run the card test, verify pass**

Run: `corepack pnpm --filter @valor/web test -- ticket-card` → PASS (3).

- [ ] **Step 6: Implement `apps/web/app/(hub)/tickets/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  assembleTicket,
  objectsByType,
  summarizeTicket,
  DEFAULT_CODED_GRAPH,
  DEFAULT_TIMELINE,
  type CodedGraph,
  type TimelineEvent,
  type TicketSummary,
} from '@valor/core';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { TicketCard } from '@/components/ticket-card';
import { LoadingState, EmptyState } from '@/components/ui/states';

export default function TicketsPage() {
  const [summaries, setSummaries] = useState<TicketSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

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
      const views = await Promise.all(
        sections.map(async (section) => {
          let events: TimelineEvent[] = await repo.loadTimeline(DEMO_ORG_ID, section.id);
          if (events.length === 0 && usingSeed) {
            events = DEFAULT_TIMELINE.filter((e) => e.ticketId === section.id);
          }
          return assembleTicket(graph, events, section.id);
        }),
      );
      if (!active) return;
      setSummaries(views.filter((v): v is NonNullable<typeof v> => v !== null).map(summarizeTicket));
      setLoaded(true);
    })().catch(() => {
      if (active) setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Operate · Tickets"
        title="Tickets"
        subtitle="Every section of the well as a coded ticket — parties, equipment, and the day's activity timeline. Press ⌘K / Ctrl-K to search the Bank."
      />
      {loaded ? (
        summaries.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaries.map((s) => (
              <TicketCard key={s.id} summary={s} />
            ))}
          </div>
        ) : (
          <EmptyState title="No tickets yet" description="Sections will appear here as they're added to the coded-object graph." />
        )
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
```

**Before writing, confirm the `EmptyState` prop names against `apps/web/components/ui/states.tsx`** (it exports `LoadingState` + `EmptyState`); adjust the `EmptyState` props (`title`/`description` or similar) to match the real component signature.

- [ ] **Step 7: Run web typecheck + tests**

Run: `corepack pnpm --filter @valor/web test -- ticket-card` → PASS. `corepack pnpm --filter @valor/web test -- planes` → PASS. `corepack pnpm --filter @valor/web typecheck` → 0.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/planes.ts apps/web/__tests__/planes.test.ts apps/web/components/ticket-card.tsx "apps/web/app/(hub)/tickets/page.tsx" apps/web/__tests__/ticket-card.test.tsx
git commit -m "feat(web): Ticket board — /tickets route + TicketCard grid over the coded graph"
```

---

### Task 3: Web — `BankSearchPalette` + global Cmd-K

**Files:**
- Create: `apps/web/components/bank-search-palette.tsx`
- Modify: `apps/web/components/app-shell.tsx`
- Test: `apps/web/__tests__/bank-search-palette.test.tsx`

- [ ] **Step 1: Write the failing palette test** — create `apps/web/__tests__/bank-search-palette.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BANK_SEED } from '@valor/core';
import { BankSearchPalette } from '@/components/bank-search-palette';

describe('BankSearchPalette', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(<BankSearchPalette open={false} onClose={() => {}} codes={BANK_SEED} />);
    expect(queryByTestId('bank-search-palette')).toBeNull();
  });

  it('renders a search input when open', () => {
    const { getByLabelText } = render(<BankSearchPalette open onClose={() => {}} codes={BANK_SEED} />);
    expect(getByLabelText(/search the bank/i)).toBeTruthy();
  });

  it('filters by code/label', () => {
    const { getByLabelText, getByText, queryByText } = render(<BankSearchPalette open onClose={() => {}} codes={BANK_SEED} />);
    fireEvent.change(getByLabelText(/search the bank/i), { target: { value: 'stuck' } });
    expect(getByText(/STUCK/)).toBeTruthy();
    expect(queryByText(/Tripping In/)).toBeNull();
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<BankSearchPalette open onClose={onClose} codes={BANK_SEED} />);
    fireEvent.keyDown(getByLabelText(/search the bank/i), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('selecting a code calls onSelect with the BankCode', () => {
    const onSelect = vi.fn();
    const { getByText } = render(<BankSearchPalette open onClose={() => {}} onSelect={onSelect} codes={BANK_SEED} />);
    fireEvent.click(getByText(/DRL — Drilling/));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: 'DRL' }));
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/web test -- bank-search-palette` → FAIL (cannot resolve component).

- [ ] **Step 3: Implement `apps/web/components/bank-search-palette.tsx`**

```tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import type { BankCode } from '@valor/core';

export interface BankSearchPaletteProps {
  open: boolean;
  onClose: () => void;
  codes: BankCode[];
  onSelect?: (code: BankCode) => void;
}

/** Global "search the Bank" command palette (Cmd/Ctrl-K). Reference picker; `onSelect` optional. */
export function BankSearchPalette({ open, onClose, codes, onSelect }: BankSearchPaletteProps) {
  const [query, setQuery] = useState('');

  // Reset the query each time the palette opens.
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const categories = [...new Set(codes.map((c) => c.category))];
    const matches = (b: BankCode) =>
      !q || b.code.toLowerCase().includes(q) || b.label.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
    return categories
      .map((category) => ({ category, items: codes.filter((b) => b.category === category && matches(b)) }))
      .filter((g) => g.items.length > 0);
  }, [codes, query]);

  if (!open) return null;

  const pick = (b: BankCode) => {
    onSelect?.(b);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      onClick={onClose}
      data-testid="bank-search-palette"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the Bank"
        className="glass-strong w-full max-w-lg overflow-hidden rounded-lg border border-gold/20 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="relative block border-b border-white/[0.08]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" aria-hidden="true" />
          <input
            type="search"
            autoFocus
            aria-label="Search the Bank"
            placeholder="Search the Bank — code, label, or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            className="w-full bg-transparent py-3 pl-10 pr-3 font-mono text-sm text-cream outline-none placeholder:text-muted-foreground/50"
          />
        </label>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto p-3">
          {groups.map((g) => (
            <div key={g.category}>
              <div className="eyebrow mb-1.5">{g.category}</div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((b) => (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => pick(b)}
                    className={
                      b.npt
                        ? 'rounded-md border border-red/30 bg-red/[0.06] px-2 py-1 font-mono text-[0.6875rem] text-red transition-colors hover:bg-red/[0.12]'
                        : 'rounded-md border border-gold/25 bg-gold/[0.05] px-2 py-1 font-mono text-[0.6875rem] text-gold-light transition-colors hover:bg-gold/[0.12]'
                    }
                  >
                    {`${b.code} — ${b.label}`}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="font-mono text-xs text-muted-foreground/50">No codes match “{query}”.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the palette test, verify pass**

Run: `corepack pnpm --filter @valor/web test -- bank-search-palette` → PASS (5).

- [ ] **Step 5: Wire the global Cmd-K into `apps/web/components/app-shell.tsx`**

Add imports at the top (keep existing):

```ts
import { useEffect, useState } from 'react';
import { BANK_SEED, type BankCode } from '@valor/core';
import { getRepo } from '@/lib/repo';
import { BankSearchPalette } from '@/components/bank-search-palette';
```

Inside the `AppShell` component body (after `const planes = planesForRole(role);`), add:

```ts
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bankCodes, setBankCodes] = useState<BankCode[]>(BANK_SEED);

  useEffect(() => {
    let active = true;
    getRepo().loadBankCodes().then((stored) => { if (active && stored) setBankCodes(stored); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
```

Then render the palette at the very end of the returned JSX, just before the closing `</div>` of the root `<div className="flex min-h-screen">`:

```tsx
      <BankSearchPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} codes={bankCodes} />
```

(E1: `onSelect` omitted — the palette is a global reference picker; selecting closes it. E2 wires `onSelect` to append a timeline event in the ticket time-view.)

- [ ] **Step 6: Verify typecheck + full web suite**

Run: `corepack pnpm --filter @valor/web typecheck` → 0. `corepack pnpm --filter @valor/web test` → all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/bank-search-palette.tsx apps/web/components/app-shell.tsx apps/web/__tests__/bank-search-palette.test.tsx
git commit -m "feat(web): global Cmd-K \"search the Bank\" command palette"
```

---

### Task 4: Verify — core suite, web, both builds, PR

**Files:** none (verification only)

- [ ] **Step 1: Full core suite + typecheck**

Run: `corepack pnpm --filter @valor/core test` → all pass (treat "all pass" as the contract). `corepack pnpm --filter @valor/core typecheck` → 0.

- [ ] **Step 2: Web typecheck + tests + normal build**

Run: `corepack pnpm --filter @valor/web typecheck` → 0. `corepack pnpm --filter @valor/web test` → all pass (+1 todo). `corepack pnpm --filter @valor/web build` → "Compiled successfully", exit 0.

- [ ] **Step 3: Static-export build (PowerShell)**

```powershell
Remove-Item -Recurse -Force apps/web/.next, apps/web/out -ErrorAction SilentlyContinue
$env:STATIC_EXPORT='true'; $env:PAGES_BASE_PATH='ValorOperations_SB'
corepack pnpm --filter @valor/web build
```
Expected: "Generating static pages (23/23)" (one more than Slice D's 22 — the new `/tickets`), exit 0, `apps/web/out/tickets/index.html` emitted. Then clear env: `Remove-Item Env:STATIC_EXPORT,Env:PAGES_BASE_PATH`.

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/ticket-board
gh pr create --base master --head feat/ticket-board --title "feat: Ticket board + search-the-Bank palette (architecture Slice E1)" --body-file <temp: summary + test plan>
```
Then run the standard dual-bot loop (CodeRabbit + Copilot), action-or-justify every finding, re-review after each push, and merge.

---

## Self-Review

**1. Spec coverage (E1 portion):**
- `summarizeTicket` + `TicketSummary` → Task 1 ✓
- `/tickets` Operate route (minRole field) + planes test → Task 2 Step 1 ✓
- Board page: load graph, seed-fallback when no sections, per-section timeline (Promise.all), assemble + summarize, grid + EmptyState + LoadingState → Task 2 Step 6 ✓
- `TicketCard` (label/code chip/status/counts/latest/warning/View-timeline link) → Task 2 Step 4 ✓
- `BankSearchPalette` (open/close, filter, groups, Esc, onSelect) → Task 3 Step 3 ✓
- Global Cmd-K in app-shell + loadBankCodes fallback → Task 3 Step 5 ✓
- Tests (summary, card, palette, planes) → Tasks 1–3 ✓
- Additive, read-only, both builds → Task 4 ✓
- E2 deferral (the `/tickets/[ticketId]` target) documented on the card link ✓

**2. Placeholder scan:** none — full code in every step; commands have expected output. (Task 4 Step 4 `--body-file` is the standard PR step; Task 2 Step 6 flags confirming `EmptyState` props against the real component — a verification instruction, not a gap.)

**3. Type consistency:** `TicketSummary`/`TicketView`/`CodedGraph`/`TimelineEvent`/`BankCode` come from `@valor/core`; `summarizeTicket`, `objectsByType`, `assembleTicket`, `DEFAULT_CODED_GRAPH`, `DEFAULT_TIMELINE` are the real exports. `TicketCard` prop `summary: TicketSummary`, `BankSearchPalette` props `{ open; onClose; codes; onSelect? }`, route `/tickets`, `data-testid` `ticket-card`/`bank-search-palette`, and the card link `/tickets/${id}` are consistent across tasks and tests.
