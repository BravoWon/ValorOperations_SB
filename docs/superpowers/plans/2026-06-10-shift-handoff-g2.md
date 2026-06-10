# Shift handoff (Slice G2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the architecture roadmap — a shift handoff derived at an operator-chosen cutoff (completed work, the carry-forward open block, pending QC/notifications) that the operator reviews, annotates, and signs, recording the handoff as an appended `milestone` TimelineEvent.

**Architecture:** One pure core module (`report/shift-handoff.ts`: `deriveHandoff(view, cutoffMin, rules?): ShiftHandoff`, truncating the projected blocks at the cutoff and reusing `deriveTimeAccounting`/`deriveNotifications`) + a `HandoffDrawer` in the ticket time-view (fixed-bottom drawer per the `RecallDrawer` precedent) wired to the time-view's existing guarded append plumbing. Carry-forward stays **computed**; the only write is the milestone append — the milestone then appears in the G1 morning report's journal, closing the loop.

**Tech Stack:** TypeScript, `@valor/core` (pure, Vitest node), `@valor/web` (Next 15 App Router, React 19, Tailwind, Vitest/jsdom). Spec: `docs/superpowers/specs/2026-06-09-handoff-morning-report-design.md` (G2 portion). Branch: `feat/shift-handoff` (created off master post-G1).

**Constraints:** No `Date.now`/`Math.random` in `@valor/core`. `warnings: string[]` (de-duped, the G1 convention), never throw. Additive except the planned ticket-time-view integration (the spec names it the G2 surface). Both typechecks 0; both builds pass (no new route — no page-count change). MockRepository default; IP guardrail generic terms only.

Commands (run from the repository root):
- Core: `corepack pnpm --filter @valor/core test -- <name>` / `test` / `typecheck`
- Web: `corepack pnpm --filter @valor/web test -- <name>` / `test` / `typecheck` / `build`

Reference shapes (verbatim):
- `TicketView { section; parties; equipment; bha; timeline: TimelineEvent[]; warnings }`; `TimelineEvent { id; orgId; ticketId; seq; atMin; kind; code?; note?; qc? }`.
- `TimeBlock { id; code; startMin; endMin; ... }`; `CodeTally { code; label; category; minutes; npt; billable }`; `DAY_MINUTES = 1440`.
- `timelineToRigDay(view)`, `deriveTimeAccounting(blocks)`, `deriveNotifications(rigDay, rules?)`, `DEFAULT_NOTIFICATION_RULES`, `Notification`.
- The time-view's append plumbing (`apps/web/components/ticket-time-view.tsx` `onPick`): `saving` guard, `mountedRef`, `crypto.randomUUID` id w/ wall-clock fallback, `appendTimelineEvent({ id, orgId: DEMO_ORG_ID, ticketId, atMin, kind, ... })`, then `load()` + re-project. The drawer precedent: `apps/web/components/recall-drawer.tsx` (fixed-bottom, `glass-strong`, z-40).
- The G1 report journal renders `milestone` events — a signed handoff becomes visible there.

---

## File Structure
- **Create `packages/core/src/report/shift-handoff.ts`** — `ShiftHandoff` + pure `deriveHandoff`.
- **Modify `packages/core/src/index.ts`** — `export * from './report/shift-handoff';`
- **Create `packages/core/test/shift-handoff.test.ts`**.
- **Create `apps/web/components/handoff-drawer.tsx`** — the review/annotate/sign drawer.
- **Modify `apps/web/components/ticket-time-view.tsx`** — "Sign handoff" affordance + the milestone append.
- **Test `apps/web/__tests__/handoff-drawer.test.tsx`** (+ extend `ticket-time-view.test.tsx` with one wiring test).

---

### Task 1: Core — `deriveHandoff` (TDD)

**Files:**
- Create: `packages/core/src/report/shift-handoff.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/shift-handoff.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/core/test/shift-handoff.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assembleTicket, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID, type TimelineEvent } from '../src/coded-object/graph';
import { deriveHandoff } from '../src/report/shift-handoff';

const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;
const ORG = DEFAULT_TIMELINE[0]!.orgId;

describe('deriveHandoff', () => {
  // Seed blocks: TIH 0–120, DRL 120–510, RIGREP 510–1440.
  it('truncates work at the cutoff and reports the spanning block as carry-forward', () => {
    const h = deriveHandoff(view, 600);
    expect(h.ticketId).toBe(SEED_TICKET_ID);
    expect(h.sectionLabel).toBe('12¼" Intermediate');
    expect(h.cutoffMin).toBe(600);
    // Completed work before 600: TIH 120 + DRL 390 + RIGREP truncated 510–600 = 90.
    const byCode = Object.fromEntries(h.completedWork.map((t) => [t.code, t.minutes]));
    expect(byCode.TIH).toBe(120);
    expect(byCode.DRL).toBe(390);
    expect(byCode.RIGREP).toBe(90);
    // RIGREP spans the cutoff → it's the carry-forward (original, untruncated).
    expect(h.carryForwardBlock?.code).toBe('RIGREP');
    expect(h.carryForwardBlock?.endMin).toBe(1440);
  });

  it('has no carry-forward when the cutoff falls on a block boundary', () => {
    const h = deriveHandoff(view, 510);
    expect(h.carryForwardBlock).toBeNull();
    const byCode = Object.fromEntries(h.completedWork.map((t) => [t.code, t.minutes]));
    expect(byCode.TIH).toBe(120);
    expect(byCode.DRL).toBe(390);
    expect(byCode.RIGREP).toBeUndefined();
  });

  it('collects pending flagged QC before the cutoff only', () => {
    const flagged: TimelineEvent[] = [
      ...DEFAULT_TIMELINE,
      { id: 'qA', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 5, atMin: 200, kind: 'qc', qc: { status: 'flagged', note: 'early flag' } },
      { id: 'qB', orgId: ORG, ticketId: SEED_TICKET_ID, seq: 6, atMin: 900, kind: 'qc', qc: { status: 'flagged', note: 'late flag' } },
    ];
    const h = deriveHandoff({ ...view, timeline: flagged }, 600);
    expect(h.pendingQcFlags).toEqual([{ atMin: 200, note: 'early flag' }]);
  });

  it('warns on an out-of-range cutoff and clamps; tolerates an empty timeline', () => {
    const bad = deriveHandoff(view, 2000);
    expect(bad.cutoffMin).toBe(1440);
    expect(bad.warnings.some((w) => /cutoff/i.test(w))).toBe(true);
    const empty = deriveHandoff({ ...view, timeline: [] }, 600);
    expect(empty.completedWork).toEqual([]);
    expect(empty.carryForwardBlock).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/core test -- shift-handoff` → FAIL (module not found).

- [ ] **Step 3: Create `packages/core/src/report/shift-handoff.ts`**

```ts
import type { TicketView } from '../coded-object/types';
import { timelineToRigDay } from '../coded-object/timeline-view';
import { deriveTimeAccounting } from '../rig-day/time-accounting';
import { DAY_MINUTES, type CodeTally, type TimeBlock } from '../rig-day/types';
import { deriveNotifications, DEFAULT_NOTIFICATION_RULES, type Notification, type NotificationRules } from '../notifications/notifications';

export interface ShiftHandoff {
  ticketId: string;
  sectionLabel: string;
  cutoffMin: number;
  completedWork: CodeTally[];
  carryForwardBlock: TimeBlock | null;
  pendingQcFlags: { atMin: number; note?: string }[];
  pendingNotifications: Notification[];
  warnings: string[];
}

/**
 * Derive a shift-handoff summary at an operator-chosen cutoff minute. Pure/deterministic;
 * never throws (an out-of-range cutoff clamps to [0, DAY_MINUTES] with a warning).
 * Carry-forward is COMPUTED, never stored — signing records a `milestone` event instead.
 */
export function deriveHandoff(view: TicketView, cutoffMin: number, rules: NotificationRules = DEFAULT_NOTIFICATION_RULES): ShiftHandoff {
  const warnings: string[] = [...view.warnings];

  let cutoff = cutoffMin;
  if (!Number.isFinite(cutoff) || cutoff < 0 || cutoff > DAY_MINUTES) {
    cutoff = Math.max(0, Math.min(DAY_MINUTES, Number.isFinite(cutoff) ? cutoff : DAY_MINUTES));
    warnings.push(`Cutoff out of range; clamped to ${cutoff} min.`);
  }

  const day = timelineToRigDay(view);

  // Truncate the projected blocks at the cutoff: keep what finished before it; clip the
  // block spanning it (its pre-cutoff span counts as completed work).
  const truncated: TimeBlock[] = [];
  let carryForwardBlock: TimeBlock | null = null;
  for (const b of day.blocks) {
    if (b.endMin <= cutoff) {
      truncated.push(b);
    } else if (b.startMin < cutoff) {
      truncated.push({ ...b, endMin: cutoff });
      carryForwardBlock = b; // the original, untruncated — what the next shift inherits
    }
  }

  const accounting = deriveTimeAccounting(truncated);
  const pendingNotifications = deriveNotifications({ ...day, blocks: truncated }, rules);

  const pendingQcFlags = view.timeline
    .filter((e) => e.kind === 'qc' && e.qc?.status === 'flagged' && e.atMin < cutoff)
    .map((e) => ({ atMin: e.atMin, ...(e.qc?.note ? { note: e.qc.note } : {}) }));

  return {
    ticketId: view.section.id,
    sectionLabel: view.section.label ?? view.section.code ?? view.section.id,
    cutoffMin: cutoff,
    completedWork: accounting.byCode,
    carryForwardBlock,
    pendingQcFlags,
    pendingNotifications,
    // De-dupe (G1 convention): both layers can flag the same issue.
    warnings: [...new Set([...warnings, ...accounting.warnings])],
  };
}
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`:** `export * from './report/shift-handoff';`

- [ ] **Step 5: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/core test -- shift-handoff` → PASS (4). If any derived tally differs, fix the ASSERTION to the true value (honest tests) and report. `corepack pnpm --filter @valor/core typecheck` → 0. Full core suite green.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/report/shift-handoff.ts packages/core/src/index.ts packages/core/test/shift-handoff.test.ts
git commit -m "feat(core): deriveHandoff — shift summary truncated at a cutoff (carry-forward computed)"
```
End every commit body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 2: Web — `HandoffDrawer` + time-view wiring (TDD)

**Files:**
- Create: `apps/web/components/handoff-drawer.tsx`
- Modify: `apps/web/components/ticket-time-view.tsx`
- Test: `apps/web/__tests__/handoff-drawer.test.tsx`

- [ ] **Step 1: Write the failing drawer test** — create `apps/web/__tests__/handoff-drawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { assembleTicket, DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID } from '@valor/core';
import { HandoffDrawer } from '@/components/handoff-drawer';

const view = assembleTicket(DEFAULT_CODED_GRAPH, DEFAULT_TIMELINE, SEED_TICKET_ID)!;

describe('HandoffDrawer', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(<HandoffDrawer open={false} view={view} onSign={() => {}} onClose={() => {}} />);
    expect(queryByTestId('handoff-drawer')).toBeNull();
  });

  it('derives the summary at the default cutoff (latest block end)', () => {
    const { getByTestId, getByText } = render(<HandoffDrawer open view={view} onSign={() => {}} onClose={() => {}} />);
    expect(getByTestId('handoff-drawer')).toBeTruthy();
    // Default cutoff 1440 → all three codes completed, no carry-forward.
    expect(getByText(/TIH/)).toBeTruthy();
    expect(getByText(/no carry-forward/i)).toBeTruthy();
  });

  it('re-derives when the cutoff changes (carry-forward appears)', () => {
    const { getByLabelText, getByText } = render(<HandoffDrawer open view={view} onSign={() => {}} onClose={() => {}} />);
    fireEvent.change(getByLabelText(/cutoff/i), { target: { value: '600' } });
    expect(getByText(/carries forward/i)).toBeTruthy(); // RIGREP spans 600
  });

  it('signing passes the cutoff and narrative to onSign', () => {
    const onSign = vi.fn();
    const { getByLabelText, getByText } = render(<HandoffDrawer open view={view} onSign={onSign} onClose={() => {}} />);
    fireEvent.change(getByLabelText(/cutoff/i), { target: { value: '600' } });
    fireEvent.change(getByLabelText(/narrative/i), { target: { value: 'Watch the pumps.' } });
    fireEvent.click(getByText(/^Sign handoff$/i));
    expect(onSign).toHaveBeenCalledWith(600, 'Watch the pumps.');
  });
});
```

- [ ] **Step 2: Run, verify fail** → cannot resolve `@/components/handoff-drawer`.

- [ ] **Step 3: Implement `apps/web/components/handoff-drawer.tsx`** (fixed-bottom drawer, the RecallDrawer pattern):

```tsx
'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { deriveHandoff, type TicketView } from '@valor/core';

export interface HandoffDrawerProps {
  open: boolean;
  view: TicketView;
  onSign: (cutoffMin: number, narrative: string) => void;
  onClose: () => void;
}

function fmtHm(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const INPUT_CLASS =
  'rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

/** Review → annotate → sign. Signing appends a `milestone` event (the caller wires the append). */
export function HandoffDrawer({ open, view, onSign, onClose }: HandoffDrawerProps) {
  const defaultCutoff = useMemo(
    () => view.timeline.reduce((m, e) => Math.max(m, e.atMin), 0) || 1440,
    [view.timeline],
  );
  const [cutoff, setCutoff] = useState<number>(defaultCutoff);
  const [narrative, setNarrative] = useState('');

  const handoff = useMemo(() => deriveHandoff(view, cutoff), [view, cutoff]);

  if (!open) return null;

  return (
    <div data-testid="handoff-drawer" className="glass-strong fixed inset-x-0 bottom-0 z-40 border-t border-gold/20 p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm text-cream">Shift handoff — {handoff.sectionLabel}</h3>
          <button type="button" aria-label="Close handoff" onClick={onClose} className="rounded-md border border-white/[0.08] p-1 text-muted-foreground/60 transition-colors hover:text-cream">
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>

        <label className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          Cutoff (min of day)
          <input
            aria-label="Cutoff minute"
            type="number"
            min={0}
            max={1440}
            step={5}
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value === '' ? 0 : Number(e.target.value))}
            className={`${INPUT_CLASS} w-24`}
          />
          <span className="normal-case">= {fmtHm(handoff.cutoffMin)}</span>
        </label>

        <div className="flex flex-wrap gap-3 font-mono text-xs">
          {handoff.completedWork.map((t) => (
            <span key={t.code} className={t.npt ? 'text-red' : 'text-muted-foreground'}>
              {t.code} {fmtHm(t.minutes)}
            </span>
          ))}
          {handoff.completedWork.length === 0 && <span className="text-muted-foreground/60">No completed work before the cutoff.</span>}
        </div>

        <div className="font-mono text-xs">
          {handoff.carryForwardBlock ? (
            <span className="text-gold-light">
              {handoff.carryForwardBlock.code} carries forward (open since {fmtHm(handoff.carryForwardBlock.startMin)})
            </span>
          ) : (
            <span className="text-muted-foreground/60">No carry-forward — the cutoff falls on a block boundary.</span>
          )}
          {handoff.pendingQcFlags.length > 0 && (
            <span className="ml-3 text-red">{handoff.pendingQcFlags.length} QC flag(s) pending</span>
          )}
        </div>

        <label className="flex flex-col gap-1 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          Narrative
          <textarea
            aria-label="Handoff narrative"
            rows={2}
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="What the next shift needs to know…"
            className={`${INPUT_CLASS} w-full normal-case`}
          />
        </label>

        <div>
          <button type="button" onClick={() => onSign(handoff.cutoffMin, narrative.trim())} className={BTN_CLASS}>
            Sign handoff
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the drawer test, verify pass** (4). If a copy assertion is ambiguous in jsdom, make it honest + unambiguous and report.

- [ ] **Step 5: Wire the time-view** (`apps/web/components/ticket-time-view.tsx`):

The component currently holds `day` (the projected RigDay) but not the raw `TicketView` — the drawer needs the view. Make these additions (keep everything else):
1. Add state: `const [view, setView] = useState<TicketView | null>(null);` and `const [handoffOpen, setHandoffOpen] = useState(false);` (import `type TicketView` + `HandoffDrawer`).
2. In the load effect and in `onPick`'s reload, alongside `setDay(view ? timelineToRigDay(view) : null)`, also `setView(view)` (the local variable already exists in both places; in the effect reset also `setView(null)`).
3. Add a "Sign handoff" button next to "Log activity" in the PageHeader actions (same `BTN_CLASS`, `disabled={saving}`, shown only when `day` — i.e. inside the existing `{day && (...)}` block, wrap both buttons in a fragment):
```tsx
            {day && (
              <>
                <button type="button" onClick={() => setPaletteOpen(true)} disabled={saving} className={BTN_CLASS}>
                  <Search className="h-3.5 w-3.5" strokeWidth={2} /> {saving ? 'Logging…' : 'Log activity'}
                </button>
                <button type="button" onClick={() => setHandoffOpen(true)} disabled={saving} className={BTN_CLASS}>
                  Sign handoff
                </button>
              </>
            )}
```
4. Add the sign handler (mirrors `onPick`'s guard/append/reload discipline):
```tsx
  const onSignHandoff = async (cutoffMin: number, narrative: string) => {
    if (!day || saving) return;
    setSaving(true);
    try {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ev-${cutoffMin}-handoff-${Date.now()}`;
      const note = `Shift handoff @ ${String(Math.floor(cutoffMin / 60)).padStart(2, '0')}:${String(cutoffMin % 60).padStart(2, '0')}${narrative ? ` — ${narrative}` : ''}`;
      await getRepo().appendTimelineEvent({ id, orgId: DEMO_ORG_ID, ticketId, atMin: cutoffMin, kind: 'milestone', note });
      setHandoffOpen(false);
      const v = await load();
      if (!mountedRef.current) return;
      setView(v);
      setDay(v ? timelineToRigDay(v) : null);
      setWarnings(v?.warnings ?? []);
    } catch {
      // Append failed — keep the drawer open so the operator can retry.
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };
```
5. Render the drawer at the end of the returned JSX (next to the palette):
```tsx
      {view && <HandoffDrawer open={handoffOpen} view={view} onSign={onSignHandoff} onClose={() => setHandoffOpen(false)} />}
```

- [ ] **Step 6: Extend `apps/web/__tests__/ticket-time-view.test.tsx`** with one wiring test:

```tsx
  it('offers "Sign handoff" once a ticket loads', async () => {
    const { findByText, getByRole } = render(<TicketTimeView ticketId={SEED_TICKET_ID} />);
    await findByText(/12¼" Intermediate/);
    expect(getByRole('button', { name: /sign handoff/i })).toBeTruthy();
  });
```

- [ ] **Step 7: Verify**

Run: `corepack pnpm --filter @valor/web test -- "handoff-drawer|ticket-time-view"` → PASS. `corepack pnpm --filter @valor/web typecheck` → 0. `corepack pnpm --filter @valor/web test` → all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/handoff-drawer.tsx apps/web/components/ticket-time-view.tsx apps/web/__tests__/handoff-drawer.test.tsx apps/web/__tests__/ticket-time-view.test.tsx
git commit -m "feat(web): shift handoff — derive/annotate/sign in the ticket time-view (milestone append)"
```

---

### Task 3: Verify — suites, both builds, PR

- [ ] **Step 1:** Full core + web suites + both typechecks → green/0.
- [ ] **Step 2:** Normal build → compiled. Static export (PowerShell, the standard env) → same page count as G1 (no new route), exit 0; clear env.
- [ ] **Step 3:** `git push -u origin feat/shift-handoff`; `gh pr create` (title "feat: Shift handoff — sign a milestone from the ticket time-view (architecture Slice G2 — completes the roadmap)"); standard dual-bot loop; merge.

---

## Self-Review

**1. Spec coverage (G2):** `deriveHandoff` (cutoff truncation; spanning block = carry-forward original; completedWork via truncated `deriveTimeAccounting`; pending QC < cutoff; pending notifications over truncated blocks; clamp+warn; de-duped warnings) → Task 1 ✓. Operator-chosen cutoff defaulting to the latest event (the drawer's `defaultCutoff`) ✓. Review/annotate/sign drawer + the single `milestone` append via the existing guarded plumbing → Task 2 ✓. The milestone surfaces in G1's journal (no extra wiring — the report already renders milestones) ✓. No new storage; carry-forward computed ✓. Tests (core ×4, drawer ×4, wiring ×1) ✓.

**2. Placeholder scan:** none — full code in every step.

**3. Type consistency:** `ShiftHandoff` fields match between core and the drawer's usage; `deriveHandoff(view, cutoff)` matches the drawer's `useMemo`; `onSign(cutoffMin, narrative)` matches the wiring's `onSignHandoff` signature; the append uses `kind: 'milestone'` with the required `id` and no `seq` per the repository contract; `TicketView` is threaded via new `view` state set at the same three points `day` is set.
