# Rig Day Swimlanes Implementation Plan (slice 4b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** People, equipment, and progress swimlanes under the activity timeline, sharing the 24h/5-min axis — people & equipment as the same coded-time-span primitive (`LaneItem`).

**Architecture:** Pure `@valor/core` `rig-day/lanes` module (`LaneItem`, coded catalogs, `deriveProgress`) + `RigDay.people/equipment`; web renders stacked lanes sharing one `minToPct` and a generic lane editor. Mirrors the shipped rig-day / well-setup pattern.

**Spec:** `docs/superpowers/specs/2026-06-08-rig-day-swimlanes-design.md`

**Conventions:** extensionless imports; pure fns never throw; no `Date.now()`/`Math.random()` in core; reuse the shipped `rig-day` types + `snapTo5`; back-compat — `RigDay.people/equipment` are optional (older saved days lack them); add exports to `index.ts`.

---

## Task 1: Lanes module — `LaneItem`, catalogs, `deriveProgress`

**Files:** Create `packages/core/src/rig-day/lanes.ts`, add tests to `packages/core/test/rig-day.test.ts`

- [ ] **Step 1: Failing test** (append to `rig-day.test.ts`)

```ts
import { PARTY_ROLES, EQUIPMENT_CATEGORIES, findPartyRole, deriveProgress } from '../src/rig-day/lanes';

describe('rig-day lanes', () => {
  it('catalogs have unique codes', () => {
    for (const cat of [PARTY_ROLES, EQUIPMENT_CATEGORIES]) {
      const codes = cat.map((c) => c.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
  it('finds a party role', () => { expect(findPartyRole(PARTY_ROLES[0]!.code)?.label).toBeTruthy(); });
  it('derives a time-ordered depth curve from block depths', () => {
    const pts = deriveProgress([
      { id: 'a', code: 'DRL', startMin: 0, endMin: 60, depthStartFt: 100, depthEndFt: 200 },
      { id: 'b', code: 'DRL', startMin: 60, endMin: 120, depthStartFt: 200, depthEndFt: 350 },
    ]);
    expect(pts[0]).toEqual({ atMin: 0, depthFt: 100 });
    expect(pts[pts.length - 1]).toEqual({ atMin: 120, depthFt: 350 });
    expect(pts.every((p, i) => i === 0 || p.atMin >= pts[i - 1]!.atMin)).toBe(true);
  });
  it('ignores blocks without depths', () => {
    expect(deriveProgress([{ id: 'x', code: 'CIRC', startMin: 0, endMin: 30 }])).toEqual([]);
  });
});
```

- [ ] **Step 2:** `corepack pnpm --filter @valor/core test rig-day` → FAIL.
- [ ] **Step 3: Implement** `lanes.ts`:

```ts
import type { TimeBlock } from './types';

export interface LaneItem { id: string; code: string; label: string; startMin: number; endMin: number; }
export interface CatalogCode { code: string; label: string; group: string; }

export const PARTY_ROLES: CatalogCode[] = [
  { code: 'OPREP', label: 'Operator Rep', group: 'Operator' },
  { code: 'COMPANY', label: 'Company Representative', group: 'Operator' },
  { code: 'DD', label: 'Directional Driller', group: 'Service' },
  { code: 'MWD', label: 'MWD Tech', group: 'Service' },
  { code: 'MUD', label: 'Mud Engineer', group: 'Service' },
  { code: 'CMTCRW', label: 'Cement Crew', group: 'Vendor' },
  { code: 'WLCRW', label: 'Wireline Crew', group: 'Vendor' },
  { code: 'INSP', label: 'Inspector', group: 'Visitor' },
  { code: 'VISITOR', label: 'Visitor', group: 'Visitor' },
  { code: 'DRIVER', label: 'Equipment Driver', group: 'Vendor' },
];

export const EQUIPMENT_CATEGORIES: CatalogCode[] = [
  { code: 'RIG', label: 'Rig', group: 'Rig' },
  { code: 'PUMPS', label: 'Mud Pumps', group: 'Circulation' },
  { code: 'BOP', label: 'BOP Stack', group: 'Pressure' },
  { code: 'TANKS', label: 'Tanks / Pits', group: 'Fluids' },
  { code: 'POWER', label: 'Power / Generators', group: 'Power' },
  { code: 'WLUNIT', label: 'Wireline Unit', group: 'Service' },
  { code: 'CMTUNIT', label: 'Cement Unit', group: 'Service' },
  { code: 'TOOLS', label: 'Tools / BHA', group: 'Downhole' },
];

export function findPartyRole(code: string): CatalogCode | undefined {
  return PARTY_ROLES.find((c) => c.code === code);
}
export function findEquipmentCategory(code: string): CatalogCode | undefined {
  return EQUIPMENT_CATEGORIES.find((c) => c.code === code);
}

export interface ProgressPoint { atMin: number; depthFt: number; }

export function deriveProgress(blocks: TimeBlock[]): ProgressPoint[] {
  const withDepth = blocks
    .filter((b) => Number.isFinite(b.depthStartFt) && Number.isFinite(b.depthEndFt))
    .sort((a, b) => a.startMin - b.startMin);
  const pts: ProgressPoint[] = [];
  for (const b of withDepth) {
    const a = { atMin: b.startMin, depthFt: b.depthStartFt as number };
    const c = { atMin: b.endMin, depthFt: b.depthEndFt as number };
    const last = pts[pts.length - 1];
    if (!last || last.atMin !== a.atMin || last.depthFt !== a.depthFt) pts.push(a);
    pts.push(c);
  }
  return pts;
}
```

- [ ] **Step 4:** test → PASS. **Step 5:** Commit `feat(core): rig-day lanes — LaneItem, coded catalogs, deriveProgress`.

## Task 2: Extend `RigDay` with optional lanes + seed

**Files:** Modify `packages/core/src/rig-day/types.ts`, `packages/core/src/rig-day/seed.ts`; add test

- [ ] **Step 1: Failing test** (append)

```ts
import { DEFAULT_RIG_DAY } from '../src/rig-day/seed';
it('seed includes people and equipment lanes', () => {
  expect((DEFAULT_RIG_DAY.people ?? []).length).toBeGreaterThanOrEqual(2);
  expect((DEFAULT_RIG_DAY.equipment ?? []).length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — in `types.ts` add to `RigDay` (import `LaneItem`):

```ts
import type { LaneItem } from './lanes';
// ...inside RigDay:
  people?: LaneItem[];
  equipment?: LaneItem[];
```

(NOTE: avoid a circular type issue — `lanes.ts` imports `TimeBlock` from `types.ts`; `types.ts` importing `LaneItem` from `lanes.ts` is a type-only cycle, which TS resolves. Use `import type`.)

In `seed.ts` add to `DEFAULT_RIG_DAY`:

```ts
  people: [
    { id: 'p1', code: 'DD', label: 'DD (days)', startMin: 0, endMin: 720 },
    { id: 'p2', code: 'MWD', label: 'MWD (days)', startMin: 0, endMin: 720 },
    { id: 'p3', code: 'MUD', label: 'Mud Engineer', startMin: 120, endMin: 885 },
    { id: 'p4', code: 'INSP', label: 'BOP Inspector', startMin: 480, endMin: 600 },
  ],
  equipment: [
    { id: 'e1', code: 'RIG', label: 'Rig', startMin: 0, endMin: 885 },
    { id: 'e2', code: 'PUMPS', label: 'Triplex Pumps', startMin: 120, endMin: 840 },
    { id: 'e3', code: 'WLUNIT', label: 'Wireline Unit', startMin: 840, endMin: 885 },
  ],
```

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(core): RigDay people/equipment lanes + seed`.

## Task 3: Export + full core gate

**Files:** Modify `packages/core/src/index.ts`

- [ ] Add `export * from './rig-day/lanes';`. Run `corepack pnpm --filter @valor/core test` (all green) + `typecheck` (0). Commit `feat(core): export rig-day lanes`.

## Task 4: `<RigDayLanes>` (people · equipment · progress)

**Files:** Create `apps/web/components/rig-day-lanes.tsx`, `apps/web/__tests__/rig-day-lanes.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DEFAULT_RIG_DAY, deriveProgress } from '@valor/core';
import { RigDayLanes } from '@/components/rig-day-lanes';

it('renders a bar per person + equipment and a progress path', () => {
  const { getAllByTestId, container } = render(
    <RigDayLanes day={DEFAULT_RIG_DAY} progress={deriveProgress(DEFAULT_RIG_DAY.blocks)} />,
  );
  expect(getAllByTestId('person-item').length).toBe((DEFAULT_RIG_DAY.people ?? []).length);
  expect(getAllByTestId('equipment-item').length).toBe((DEFAULT_RIG_DAY.equipment ?? []).length);
  expect(container.querySelector('[data-testid="progress-path"]')).toBeTruthy();
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — three stacked lane rows sharing `minToPct = (m) => (m/1440)*100`:
  - **People**: each `people[]` item a bar (`data-testid="person-item"`, `left/width` by min, color by `findPartyRole(code)?.group`), labeled `label`.
  - **Equipment**: each `equipment[]` item a bar (`data-testid="equipment-item"`, color by `findEquipmentCategory(code)?.group`).
  - **Progress**: an SVG (`viewBox="0 0 1000 120"`) with a polyline/path (`data-testid="progress-path"`) of `deriveProgress` points — x = `atMin/1440*1000`, y = depth scaled to `[min..max]` inverted (deeper lower); a current-depth label. Empty-state text when no points.
  - Each lane labeled (eyebrow); a shared "now" marker at `max(block.endMin)`. Props `{ day: RigDay; progress: ProgressPoint[] }`. Valor brand; group→color map inlined.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): rig-day people/equipment/progress lanes`.

## Task 5: `<LaneEditors>` (generic add/edit for a lane)

**Files:** Create `apps/web/components/lane-editors.tsx`, `apps/web/__tests__/lane-editors.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PARTY_ROLES } from '@valor/core';
import { LaneEditors } from '@/components/lane-editors';

it('adds an item from the catalog', () => {
  const onChange = vi.fn();
  const { getByRole } = render(
    <LaneEditors title="People" items={[]} catalog={PARTY_ROLES} onChange={onChange} idPrefix="p" />,
  );
  fireEvent.click(getByRole('button', { name: /add/i }));
  expect(onChange).toHaveBeenCalled();
  const next = onChange.mock.calls.at(-1)?.[0];
  expect(next.length).toBe(1);
  expect(next[0].code).toBe(PARTY_ROLES[0].code);
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — `LaneEditors({ title, items, catalog, onChange, idPrefix }: { title: string; items: LaneItem[]; catalog: CatalogCode[]; onChange: (next: LaneItem[]) => void; idPrefix: string })`. An "Add" button appends `{ id: `${idPrefix}-${items.length+1}`, code: catalog[0].code, label: catalog[0].label, startMin: snapped last end or 0, endMin: +60 }`. Per-row: code `<select>` (catalog), name text input, start/end number inputs (`aria-label` "Start (min)"/"End (min)", snap on blur), remove. **No `Date.now()`/`Math.random()`** for ids.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): generic lane editors`.

## Task 6: Wire into `/rig-day`

**Files:** Modify `apps/web/app/(hub)/rig-day/page.tsx`

- [ ] **Step 1: Implement** — compute `progress = deriveProgress(day.blocks)` (memoized). Render `<RigDayLanes day={day} progress={progress} />` directly under the timeline card. Add two `<LaneEditors>` (People → `day.people ?? []` → `onChange={(people)=>setDay({...day, people})}`; Equipment → `day.equipment ?? []` → `onChange`), using `PARTY_ROLES` / `EQUIPMENT_CATEGORIES`. Use `??[]` everywhere for back-compat. **Save** already persists the whole `RigDay` (now incl. lanes). Keep ids collision-safe (seed counters from existing lane lengths if using a ref, or use the `idPrefix-${len}` scheme in `LaneEditors`).

- [ ] **Step 2:** `corepack pnpm --filter @valor/web test` green; `typecheck` 0; `build` compiles `/rig-day`. **Step 3:** Commit `feat(web): wire swimlanes + editors into rig-day`.

## Task 7: Integrate, verify, ship

- [ ] core `test`+`typecheck`, web `test`+`typecheck`+`build` all green.
- [ ] Restart server on 3210; capture `/rig-day` screenshots (lanes + progress + add-from-catalog); send for punchlist.
- [ ] Push `feat/rig-day-swimlanes`; open PR (base `master`); action CodeRabbit + Copilot per max-adherence; merge on clean final review.

## Self-Review
- **Spec coverage:** LaneItem/catalogs/deriveProgress (§1 ✓ T1), RigDay lanes + seed (§1 ✓ T2), lanes render (§2 ✓ T4), editors (§2 ✓ T5), page wiring (§2 ✓ T6), DoD (§4 ✓ T7).
- **Type consistency:** `LaneItem`/`CatalogCode`/`ProgressPoint`/`deriveProgress`/`PARTY_ROLES`/`EQUIPMENT_CATEGORIES`/`RigDay.people|equipment` consistent across tasks; back-compat `?? []`.
- **No placeholders:** core steps carry full code; web steps carry signatures, render contracts (`data-testid`s), and tests.
