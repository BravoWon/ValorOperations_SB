# Rig Day Timeline Implementation Plan (slice 4a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Coded activity blocks on a 24h/5-min timeline with live time-accounting (hours-by-activity, NPT, unaccounted gaps).

**Architecture:** Pure `@valor/core` rig-day module (types · `snapTo5` · `deriveTimeAccounting` · seed · repo seam) drives a registry-style React timeline + Bank palette + accounting rail. Mirrors the shipped `projectWellbore` / well-setup pattern.

**Spec:** `docs/superpowers/specs/2026-06-08-rig-day-timeline-design.md`

**Conventions:** extensionless imports; pure functions return `warnings: string[]`, never throw; repo persistence uses `globalThis.localStorage` + in-memory `Map` fallback (see `MockRepository.saveWellSetup`); reuse `BANK_SEED`/`findBankCode` from `well-setup/bank`; new exports added to `packages/core/src/index.ts`.

---

## Task 1: Rig-day types + `snapTo5`

**Files:** Create `packages/core/src/rig-day/types.ts`, `packages/core/src/rig-day/time-accounting.ts` (snap only here), `packages/core/test/rig-day.test.ts`

- [ ] **Step 1: Failing test** (`rig-day.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { snapTo5, DAY_MINUTES } from '../src/rig-day/time-accounting';

describe('snapTo5', () => {
  it('rounds to nearest 5', () => { expect(snapTo5(72)).toBe(70); expect(snapTo5(73)).toBe(75); });
  it('clamps to [0,1440]', () => { expect(snapTo5(-10)).toBe(0); expect(snapTo5(99999)).toBe(DAY_MINUTES); });
  it('non-finite → 0', () => { expect(snapTo5(NaN)).toBe(0); });
});
```

- [ ] **Step 2:** `corepack pnpm --filter @valor/core test rig-day` → FAIL.
- [ ] **Step 3: Implement** `types.ts`:

```ts
export interface TimeBlock {
  id: string; code: string; startMin: number; endMin: number;
  depthStartFt?: number; depthEndFt?: number; note?: string;
}
export interface RigDay { id: string; label: string; blocks: TimeBlock[]; }
export interface CodeTally {
  code: string; label: string; category: string; minutes: number; npt: boolean; billable: boolean;
}
export interface TimeAccounting {
  totalLoggedMin: number; productiveMin: number; nptMin: number;
  byCode: CodeTally[]; unaccountedGaps: { startMin: number; endMin: number }[]; warnings: string[];
}
export const DAY_MINUTES = 1440;
```

and `time-accounting.ts` (snap first; derive added next task):

```ts
import { DAY_MINUTES } from './types';
export { DAY_MINUTES };
export function snapTo5(min: number): number {
  if (!Number.isFinite(min)) return 0;
  const clamped = Math.max(0, Math.min(DAY_MINUTES, min));
  return Math.round(clamped / 5) * 5;
}
```

- [ ] **Step 4:** test → PASS. **Step 5:** Commit `feat(core): rig-day types + snapTo5`.

## Task 2: `deriveTimeAccounting`

**Files:** Modify `time-accounting.ts`; add tests to `rig-day.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { deriveTimeAccounting } from '../src/rig-day/time-accounting';
import type { TimeBlock } from '../src/rig-day/types';

const B = (code: string, startMin: number, endMin: number): TimeBlock => ({ id: `${code}-${startMin}`, code, startMin, endMin });

describe('deriveTimeAccounting', () => {
  it('sums minutes by code', () => {
    const a = deriveTimeAccounting([B('DRL', 0, 60), B('DRL', 120, 180), B('TIH', 60, 120)]);
    expect(a.totalLoggedMin).toBe(180);
    expect(a.byCode.find((c) => c.code === 'DRL')?.minutes).toBe(120);
  });
  it('splits NPT from productive', () => {
    const a = deriveTimeAccounting([B('DRL', 0, 60), B('RIGREP', 60, 120)]); // RIGREP is npt:true
    expect(a.nptMin).toBe(60);
    expect(a.productiveMin).toBe(60);
  });
  it('reports unaccounted gaps within [0, now]', () => {
    const a = deriveTimeAccounting([B('DRL', 0, 60), B('TIH', 120, 180)]);
    expect(a.unaccountedGaps).toEqual([{ startMin: 60, endMin: 120 }]);
  });
  it('warns on overlap', () => {
    const a = deriveTimeAccounting([B('DRL', 0, 90), B('TIH', 60, 120)]);
    expect(a.warnings.some((w) => /overlap/i.test(w))).toBe(true);
  });
  it('warns on unknown code', () => {
    const a = deriveTimeAccounting([B('ZZZ', 0, 30)]);
    expect(a.warnings.some((w) => /bank/i.test(w))).toBe(true);
  });
});
```

- [ ] **Step 2:** test → FAIL.
- [ ] **Step 3: Implement** (append to `time-accounting.ts`):

```ts
import type { TimeBlock, TimeAccounting, CodeTally } from './types';
import { findBankCode } from '../well-setup/bank';

export function deriveTimeAccounting(blocks: TimeBlock[], nowMin?: number): TimeAccounting {
  const warnings: string[] = [];
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);
  const tallies = new Map<string, CodeTally>();
  let totalLoggedMin = 0, nptMin = 0, prevEnd = -Infinity;

  for (const b of sorted) {
    const dur = b.endMin - b.startMin;
    if (dur <= 0) { warnings.push(`Block "${b.code}" has a non-positive span.`); continue; }
    if (b.startMin < prevEnd) warnings.push(`Blocks overlap near ${b.startMin} min.`);
    prevEnd = Math.max(prevEnd, b.endMin);
    const code = findBankCode(b.code);
    if (!code) warnings.push(`Code "${b.code}" is not in the Bank.`);
    const t = tallies.get(b.code) ?? {
      code: b.code, label: code?.label ?? b.code, category: code?.category ?? '—',
      minutes: 0, npt: code?.npt ?? false, billable: code?.billable ?? false,
    };
    t.minutes += dur;
    tallies.set(b.code, t);
    totalLoggedMin += dur;
    if (t.npt) nptMin += dur;
  }

  const byCode = [...tallies.values()].sort((a, b) => b.minutes - a.minutes);
  const now = Number.isFinite(nowMin as number)
    ? (nowMin as number)
    : sorted.length ? Math.max(...sorted.map((b) => b.endMin)) : 0;

  const merged: { s: number; e: number }[] = [];
  for (const b of sorted) {
    if (b.endMin <= b.startMin) continue;
    const last = merged[merged.length - 1];
    if (last && b.startMin <= last.e) last.e = Math.max(last.e, b.endMin);
    else merged.push({ s: b.startMin, e: b.endMin });
  }
  const unaccountedGaps: { startMin: number; endMin: number }[] = [];
  let cursor = 0;
  for (const m of merged) {
    if (m.s > cursor && cursor < now) unaccountedGaps.push({ startMin: cursor, endMin: Math.min(m.s, now) });
    cursor = Math.max(cursor, m.e);
    if (cursor >= now) break;
  }
  if (cursor < now) unaccountedGaps.push({ startMin: cursor, endMin: now });

  return { totalLoggedMin, productiveMin: totalLoggedMin - nptMin, nptMin, byCode, unaccountedGaps, warnings };
}
```

- [ ] **Step 4:** test → PASS. **Step 5:** Commit `feat(core): deriveTimeAccounting (hours-by-code, NPT, gaps)`.

## Task 3: `DEFAULT_RIG_DAY` seed

**Files:** Create `packages/core/src/rig-day/seed.ts`; add test to `rig-day.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { DEFAULT_RIG_DAY } from '../src/rig-day/seed';
import { deriveTimeAccounting } from '../src/rig-day/time-accounting';

it('default rig day has blocks incl. an NPT one', () => {
  expect(DEFAULT_RIG_DAY.blocks.length).toBeGreaterThanOrEqual(5);
  const a = deriveTimeAccounting(DEFAULT_RIG_DAY.blocks);
  expect(a.nptMin).toBeGreaterThan(0);
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** (brand-free; codes from `BANK_SEED`):

```ts
import type { RigDay } from './types';
export const DEFAULT_RIG_DAY: RigDay = {
  id: 'demo', label: 'Day 1',
  blocks: [
    { id: 'b1', code: 'TIH',  startMin: 0,    endMin: 120,  depthStartFt: 0,    depthEndFt: 6400 },
    { id: 'b2', code: 'CIRC', startMin: 120,  endMin: 165 },
    { id: 'b3', code: 'DRL',  startMin: 165,  endMin: 480,  depthStartFt: 6400, depthEndFt: 7100 },
    { id: 'b4', code: 'CONN', startMin: 480,  endMin: 510 },
    { id: 'b5', code: 'RIGREP', startMin: 510, endMin: 600 },   // NPT
    { id: 'b6', code: 'DRL',  startMin: 600,  endMin: 840,  depthStartFt: 7100, depthEndFt: 7480 },
    { id: 'b7', code: 'SVY',  startMin: 840,  endMin: 885 },
  ],
};
```

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(core): default rig-day seed`.

## Task 4: Repository seam (save/load rig day)

**Files:** Modify `repository.ts`, `mock-repository.ts`; add test `packages/core/test/mock-repository.rigday.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEFAULT_RIG_DAY } from '../src/rig-day/seed';

describe('MockRepository rig day', () => {
  it('null before save', async () => { expect(await new MockRepository().loadRigDay('demo')).toBeNull(); });
  it('round-trips', async () => {
    const r = new MockRepository(); await r.saveRigDay('demo', DEFAULT_RIG_DAY);
    expect((await r.loadRigDay('demo'))?.blocks.length).toBe(DEFAULT_RIG_DAY.blocks.length);
  });
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — add to `Repository`:

```ts
saveRigDay(id: string, day: import('./rig-day/types').RigDay): Promise<void>;
loadRigDay(id: string): Promise<import('./rig-day/types').RigDay | null>;
```

In `MockRepository` (mirror `saveWellSetup`):

```ts
private rigDays = new Map<string, import('./rig-day/types').RigDay>();
private rigDayKey(id: string) { return `valor:rigday:${id}`; }
async saveRigDay(id: string, day: import('./rig-day/types').RigDay): Promise<void> {
  const store = this.browserStorage;
  if (store) store.setItem(this.rigDayKey(id), JSON.stringify(day));
  else this.rigDays.set(id, structuredClone(day));
}
async loadRigDay(id: string): Promise<import('./rig-day/types').RigDay | null> {
  const store = this.browserStorage;
  if (store) { const raw = store.getItem(this.rigDayKey(id)); if (raw) { try { return JSON.parse(raw); } catch { return null; } } return null; }
  return this.rigDays.has(id) ? structuredClone(this.rigDays.get(id)!) : null;
}
```

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(core): repository seam for rig-day save/load`.

## Task 5: Export

**Files:** Modify `packages/core/src/index.ts`

- [ ] Add `export * from './rig-day/types';`, `export * from './rig-day/time-accounting';`, `export * from './rig-day/seed';`. Run full core `test` + `typecheck` (both green). Commit `feat(core): export rig-day module`.

## Task 6: `<RigDayTimeline>` (render)

**Files:** Create `apps/web/components/rig-day-timeline.tsx`, `apps/web/__tests__/rig-day-timeline.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DEFAULT_RIG_DAY } from '@valor/core';
import { RigDayTimeline } from '@/components/rig-day-timeline';

it('renders a track with a block per entry', () => {
  const { container, getAllByTestId } = render(<RigDayTimeline day={DEFAULT_RIG_DAY} />);
  expect(container.querySelector('[data-testid="rig-day-track"]')).toBeTruthy();
  expect(getAllByTestId('rig-block').length).toBe(DEFAULT_RIG_DAY.blocks.length);
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — a horizontal track (`data-testid="rig-day-track"`, `position:relative`, full width). For each block render an absolutely-positioned bar (`data-testid="rig-block"`, `left: (startMin/1440)*100%`, `width: ((endMin-startMin)/1440)*100%`), colored by Bank category (map category→color), labeled with `code`. Hour gridlines (24) + a "now" marker line at `max(endMin)/1440`. Props: `{ day: RigDay }`. Valor brand tokens; print-clean.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): rig-day timeline render`.

## Task 7: `<BankPalette>` + `<RigDayEditors>`

**Files:** Create `apps/web/components/bank-palette.tsx`, `apps/web/components/rig-day-editors.tsx`, `apps/web/__tests__/rig-day-editors.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DEFAULT_RIG_DAY } from '@valor/core';
import { BankPalette } from '@/components/bank-palette';

it('adds a coded block on click', () => {
  const onAdd = vi.fn();
  const { getByRole } = render(<BankPalette onAdd={onAdd} />);
  fireEvent.click(getByRole('button', { name: /Drilling/i }));
  expect(onAdd).toHaveBeenCalledWith('DRL');
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement**
  - `BankPalette({ onAdd }: { onAdd: (code: string) => void })` — a searchable list over `BANK_SEED` grouped by category; each entry a `<button>` labeled `${code} — ${label}` that calls `onAdd(code)`.
  - `RigDayEditors({ day, onChange })` — per-block rows: code `<select>` (BANK_SEED), start/end number inputs (`aria-label` "Start (min)"/"End (min)", `onBlur` → `snapTo5`), remove button. The page wires "add" = append a `snapTo5`-aligned 30-min block after the last (id via `Date`-free counter, e.g. `b-${day.blocks.length+1}-${startMin}`).

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): bank palette + rig-day block editors`.

## Task 8: `<TimeAccountingRail>`

**Files:** Create `apps/web/components/time-accounting-rail.tsx`, `apps/web/__tests__/time-accounting-rail.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { deriveTimeAccounting, DEFAULT_RIG_DAY } from '@valor/core';
import { TimeAccountingRail } from '@/components/time-accounting-rail';

it('shows NPT and per-code tallies', () => {
  const acc = deriveTimeAccounting(DEFAULT_RIG_DAY.blocks);
  const { getByText, getAllByTestId } = render(<TimeAccountingRail accounting={acc} />);
  expect(getByText(/NPT/i)).toBeTruthy();
  expect(getAllByTestId('code-tally').length).toBe(acc.byCode.length);
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — headline productive vs **NPT** hours (minutes→`h:mm`); `byCode` as horizontal bars (`data-testid="code-tally"`, width ∝ minutes, NPT bars in `--red`); an "unaccounted" chip when `unaccountedGaps.length`. Props `{ accounting: TimeAccounting }`.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): time-accounting rail`.

## Task 9: `/rig-day` page + nav

**Files:** Create `apps/web/app/(hub)/rig-day/page.tsx`; modify `apps/web/components/app-shell.tsx`

- [ ] **Step 1: Implement** — `'use client'`: `getRepo().loadRigDay('demo')` (fallback `DEFAULT_RIG_DAY`); state `day`; `accounting = deriveTimeAccounting(day.blocks)`; render `<RigDayTimeline>`, a "Rig Now" strip (the block covering `max(endMin)`), `<BankPalette onAdd>` (append block), `<RigDayEditors>`, `<TimeAccountingRail>`, a **Save** button → `saveRigDay`, and the warnings list. Brand `PageHeader`/`page-container`. Add a "Rig Day" link to `app-shell.tsx` nav.

- [ ] **Step 2:** `corepack pnpm --filter @valor/web build` → compiles `/rig-day`. **Step 3:** Commit `feat(web): rig-day console page + nav`.

## Task 10: Integrate, verify, ship

- [ ] core `test` + `typecheck` green; web `test` green; web `build` clean.
- [ ] Restart server on 3210; capture `/rig-day` screenshots (timeline + add-from-bank + NPT rail); send for punchlist.
- [ ] Push `feat/rig-day-console`; open PR (base `master`); action CodeRabbit + Copilot per max-adherence; merge on clean final review.

## Self-Review
- **Spec coverage:** types/snap (§2/§3 ✓ T1), derive (§3 ✓ T2), seed (§4 ✓ T3), repo (§4 ✓ T4), timeline/palette/editors/rail/page (§5 ✓ T6–T9), DoD (§7 ✓ T10).
- **Type consistency:** `TimeBlock`/`RigDay`/`TimeAccounting`/`CodeTally`/`snapTo5`/`deriveTimeAccounting`/`saveRigDay`/`loadRigDay`/`DEFAULT_RIG_DAY` consistent across tasks; codes reuse `BANK_SEED`.
- **No placeholders:** core steps carry full code; web steps carry signatures, render contracts, and tests.
