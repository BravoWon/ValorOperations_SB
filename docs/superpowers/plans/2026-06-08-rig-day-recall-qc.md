# Rig Day Recall & QC Pull-up Implementation Plan (slice 4c)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A pull-up drawer that surfaces like-items (same coded activity) from other days/wells for reuse + QC (approve/flag) on the selected block.

**Architecture:** Pure `@valor/core` `rig-day/recall` (RecallItem, RECALL_LIBRARY, findLikeItems) + `TimeBlock.qc?`; web adds a `<RecallDrawer>` and block selection on `/rig-day`. Mirrors the shipped rig-day pattern.

**Spec:** `docs/superpowers/specs/2026-06-08-rig-day-recall-qc-design.md`

**Conventions:** extensionless imports; pure fns never throw; no `Date.now()`/`Math.random()` in core; reuse Bank codes; `TimeBlock.qc` optional (back-compat); add exports to `index.ts`.

---

## Task 1: Recall library + `findLikeItems` + QC types

**Files:** Create `packages/core/src/rig-day/recall.ts`; modify `packages/core/src/rig-day/types.ts`; add tests to `packages/core/test/rig-day.test.ts`

- [ ] **Step 1: Failing test** (append to `rig-day.test.ts`)

```ts
import { RECALL_LIBRARY, findLikeItems } from '../src/rig-day/recall';
import { findBankCode } from '../src/well-setup/bank';

describe('rig-day recall', () => {
  it('every library item uses a real Bank code', () => {
    expect(RECALL_LIBRARY.every((i) => !!findBankCode(i.code))).toBe(true);
  });
  it('findLikeItems filters by code', () => {
    const code = RECALL_LIBRARY[0]!.code;
    const like = findLikeItems(code);
    expect(like.length).toBeGreaterThan(0);
    expect(like.every((i) => i.code === code)).toBe(true);
  });
  it('findLikeItems returns [] for an unknown code', () => {
    expect(findLikeItems('NOPE')).toEqual([]);
  });
});
```

- [ ] **Step 2:** `corepack pnpm --filter @valor/core test rig-day` → FAIL.
- [ ] **Step 3: Implement** `recall.ts`:

```ts
export interface RecallItem {
  id: string; code: string; label: string;
  wellLabel: string; dayLabel: string;
  startMin: number; endMin: number;
  depthStartFt?: number; depthEndFt?: number;
  note?: string;
}

export const RECALL_LIBRARY: RecallItem[] = [
  { id: 'r1', code: 'TIH', label: 'Tripping In', wellLabel: 'Well A', dayLabel: 'Day 2', startMin: 0, endMin: 110, depthStartFt: 0, depthEndFt: 6200, note: 'Clean trip, no fill.' },
  { id: 'r2', code: 'DRL', label: 'Drilling', wellLabel: 'Well A', dayLabel: 'Day 2', startMin: 150, endMin: 470, depthStartFt: 6200, depthEndFt: 6950, note: 'Avg ROP 42 ft/hr.' },
  { id: 'r3', code: 'CONN', label: 'Connection', wellLabel: 'Well A', dayLabel: 'Day 2', startMin: 470, endMin: 495 },
  { id: 'r4', code: 'RIGREP', label: 'Rig Repair', wellLabel: 'Well A', dayLabel: 'Day 2', startMin: 495, endMin: 560, note: 'Pop-off valve replaced.' },
  { id: 'r5', code: 'DRL', label: 'Drilling', wellLabel: 'Well B', dayLabel: 'Day 1', startMin: 200, endMin: 520, depthStartFt: 5800, depthEndFt: 6600, note: 'Hard stringers, ROP 31.' },
  { id: 'r6', code: 'CMT', label: 'Cementing', wellLabel: 'Well B', dayLabel: 'Day 4', startMin: 600, endMin: 690, note: '15.8 ppg lead, 16.4 tail.' },
  { id: 'r7', code: 'CSG', label: 'Run Casing', wellLabel: 'Well B', dayLabel: 'Day 4', startMin: 300, endMin: 600, depthStartFt: 0, depthEndFt: 6400 },
  { id: 'r8', code: 'TOH', label: 'Tripping Out', wellLabel: 'Well B', dayLabel: 'Day 5', startMin: 0, endMin: 130, depthStartFt: 6400, depthEndFt: 0 },
  { id: 'r9', code: 'SVY', label: 'Survey / Directional', wellLabel: 'Well C', dayLabel: 'Day 2', startMin: 480, endMin: 520 },
  { id: 'r10', code: 'CIRC', label: 'Circulating', wellLabel: 'Well C', dayLabel: 'Day 2', startMin: 110, endMin: 150, note: 'Bottoms-up before survey.' },
  { id: 'r11', code: 'TIH', label: 'Tripping In', wellLabel: 'Well C', dayLabel: 'Day 3', startMin: 0, endMin: 125, depthStartFt: 0, depthEndFt: 7000 },
  { id: 'r12', code: 'DRL', label: 'Drilling', wellLabel: 'Well C', dayLabel: 'Day 3', startMin: 160, endMin: 540, depthStartFt: 7000, depthEndFt: 7820, note: 'Best day, ROP 55.' },
];

export function findLikeItems(code: string, library: RecallItem[] = RECALL_LIBRARY): RecallItem[] {
  return library
    .filter((i) => i.code === code)
    .sort((a, b) => a.wellLabel.localeCompare(b.wellLabel) || a.dayLabel.localeCompare(b.dayLabel));
}
```

and in `types.ts` add (and reference from `TimeBlock`):

```ts
export type QcStatus = 'approved' | 'flagged';
export interface QcMark { status: QcStatus; note?: string; }
// inside TimeBlock:
  qc?: QcMark;
```

- [ ] **Step 4:** test → PASS. **Step 5:** Commit `feat(core): rig-day recall library + findLikeItems + QC mark`.

## Task 2: Export

**Files:** Modify `packages/core/src/index.ts`

- [ ] Add `export * from './rig-day/recall';`. Run full `corepack pnpm --filter @valor/core test` (green) + `typecheck` (0). Commit `feat(core): export rig-day recall`.

## Task 3: `<RecallDrawer>`

**Files:** Create `apps/web/components/recall-drawer.tsx`, `apps/web/__tests__/recall-drawer.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { RECALL_LIBRARY, findLikeItems } from '@valor/core';
import type { TimeBlock } from '@valor/core';
import { RecallDrawer } from '@/components/recall-drawer';

const block: TimeBlock = { id: 'b1', code: RECALL_LIBRARY[0].code, startMin: 0, endMin: 60 };

it('lists like-items and fires reuse + qc', () => {
  const onReuse = vi.fn(); const onQc = vi.fn(); const onClose = vi.fn();
  const { getAllByTestId, getByRole } = render(
    <RecallDrawer block={block} onReuse={onReuse} onQc={onQc} onClose={onClose} />,
  );
  expect(getAllByTestId('like-item').length).toBe(findLikeItems(block.code).length);
  fireEvent.click(getAllByTestId('reuse-btn')[0]);
  expect(onReuse).toHaveBeenCalled();
  fireEvent.click(getByRole('button', { name: /approve/i }));
  expect(onQc).toHaveBeenCalledWith({ status: 'approved' });
});

it('renders nothing when no block selected', () => {
  const { container } = render(<RecallDrawer block={null} onReuse={vi.fn()} onQc={vi.fn()} onClose={vi.fn()} />);
  expect(container.firstChild).toBeNull();
});
```

- [ ] **Step 2:** `corepack pnpm --filter @valor/web test recall-drawer` → FAIL.
- [ ] **Step 3: Implement** — `RecallDrawer({ block, onReuse, onQc, onClose })`: returns `null` when `block` is null; else a fixed bottom panel (`fixed inset-x-0 bottom-0 z-40`, glass/brand, max-h with scroll):
  - Header: `${block.code} · ${codeLabel}` + span + a Close button (`onClose`).
  - QC controls: **Approve** button → `onQc({ status: 'approved' })`; **Flag** button → `onQc({ status: 'flagged' })`; a note input that, on Approve/Flag, includes `{ status, note }`; a **Clear QC** → `onQc(undefined)`. (For the test, Approve with empty note calls `onQc({ status: 'approved' })`.)
  - Like-items: `findLikeItems(block.code)` → each row `data-testid="like-item"` showing `wellLabel · dayLabel`, span, depth, note, and a **Reuse** button `data-testid="reuse-btn"` → `onReuse(item)`. Empty-state when none.
  - Resolve label via `findBankCode(block.code)?.label`.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): recall & QC drawer`.

## Task 4: Selection + QC badges (timeline + editors)

**Files:** Modify `apps/web/components/rig-day-timeline.tsx`, `apps/web/components/rig-day-editors.tsx`; tests as noted

- [ ] **Step 1: Failing test** (`apps/web/__tests__/rig-day-timeline.test.tsx` — extend)

```tsx
import { vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
it('fires onSelect when a block is clicked', () => {
  const onSelect = vi.fn();
  const { getAllByTestId } = render(<RigDayTimeline day={DEFAULT_RIG_DAY} onSelect={onSelect} />);
  fireEvent.click(getAllByTestId('rig-block')[0]);
  expect(onSelect).toHaveBeenCalled();
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement**
  - `RigDayTimeline` gains optional `onSelect?: (id: string) => void`; each `rig-block` becomes a `<button>` (or gets `onClick`/`role=button`) calling `onSelect(block.id)`; render a small **QC badge** (green check / red flag) on blocks with `block.qc`.
  - `RigDayEditors` rows gain a **"Recall / QC"** button (`aria-label`) calling an `onSelect?(id)` prop, and a QC badge when `qc` is set. (Add `onSelect?: (id: string) => void` to its props.)

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): block selection + QC badges`.

## Task 5: Wire into `/rig-day`

**Files:** Modify `apps/web/app/(hub)/rig-day/page.tsx`

- [ ] **Step 1: Implement** — add `selectedBlockId` state; pass `onSelect={setSelectedBlockId}` to `<RigDayTimeline>` and `<RigDayEditors>`; resolve `selectedBlock = day.blocks.find(b => b.id === selectedBlockId) ?? null`; render `<RecallDrawer block={selectedBlock} onReuse={...} onQc={...} onClose={() => setSelectedBlockId(null)} />`. Handlers update the block immutably in `day.blocks`:
  - `onReuse(item)`: set the block's `depthStartFt`/`depthEndFt`/`note` from `item`.
  - `onQc(mark)`: set the block's `qc = mark` (or delete when `undefined`).
  Save already persists the whole `RigDay` (incl. `qc`).

- [ ] **Step 2:** `corepack pnpm --filter @valor/web test` green; `typecheck` 0; `build` compiles `/rig-day`. **Step 3:** Commit `feat(web): wire recall/QC drawer into rig-day`.

## Task 6: Integrate, verify, ship

- [ ] core `test`+`typecheck`, web `test`+`typecheck`+`build` all green.
- [ ] Restart server on 3210; capture `/rig-day` screenshots (drawer open, like-items, QC badge); send for punchlist.
- [ ] Push `feat/rig-day-recall-qc`; open PR (base `master`); action CodeRabbit + Copilot per max-adherence; merge on clean final review.

## Self-Review
- **Spec coverage:** RecallItem/library/findLikeItems + QC types (§1 ✓ T1), export (T2), drawer (§2 ✓ T3), selection+badges (§2 ✓ T4), page wiring (§2 ✓ T5), DoD (§4 ✓ T6).
- **Type consistency:** `RecallItem`/`RECALL_LIBRARY`/`findLikeItems`/`QcStatus`/`QcMark`/`TimeBlock.qc`/`onSelect` consistent; back-compat `qc?`.
- **No placeholders:** core steps carry full code; web steps carry signatures, `data-testid` contracts, and tests.
