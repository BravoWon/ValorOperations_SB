# Wellbore Completion Enrichment — Implementation Plan (well-setup slice 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add Tubing, Completions (perforations/packers/SSSV), Cement detail, and Wellhead to the well-setup — grouped inputs + rendered on the schematic + element details.

**Architecture:** Extend the existing `@valor/core` well-setup model + `projectWellbore` (all additive/optional, back-compat), then extend the web panels (grouped sections) and the SVG schematic. No new files in core; web extends two existing components.

**Spec:** `docs/superpowers/specs/2026-06-08-well-setup-completion-design.md`

**Conventions:** extensionless imports; pure fns never throw; no `Date.now()`/`Math.random()`; all new `WellSetup` fields OPTIONAL (slice-1 saved setups must still load); registries already auto-export via `index.ts` `export * from './well-setup/*'`.

---

## Task 1: Model + registries + extended seed

**Files:** Modify `packages/core/src/well-setup/types.ts`, `packages/core/src/well-setup/field-defs.ts`; add tests to `packages/core/test/field-defs.test.ts`

- [ ] **Step 1: Failing test** (append to `field-defs.test.ts`)

```ts
import { COMPLETION_TYPES, TUBING_FIELDS, COMPLETION_COLUMNS, WELLHEAD_FIELDS } from '../src/well-setup/field-defs';
import { DEFAULT_WELL_SETUP } from '../src/well-setup/field-defs';

describe('completion registries + seed', () => {
  it('completion types include perforation/packer/sssv', () => {
    const vals = COMPLETION_TYPES.map((t) => t.value);
    expect(vals).toEqual(expect.arrayContaining(['perforation', 'packer', 'sssv']));
  });
  it('tubing + completion + wellhead registries are non-empty', () => {
    expect(TUBING_FIELDS.length).toBeGreaterThan(3);
    expect(COMPLETION_COLUMNS.length).toBeGreaterThan(3);
    expect(WELLHEAD_FIELDS.length).toBeGreaterThan(2);
  });
  it('default seed has tubing, completions (incl. a perforation), and a wellhead', () => {
    expect(DEFAULT_WELL_SETUP.tubing).toBeTruthy();
    expect((DEFAULT_WELL_SETUP.completions ?? []).some((c) => c.type === 'perforation')).toBe(true);
    expect(DEFAULT_WELL_SETUP.wellhead).toBeTruthy();
  });
  it('production casing seed carries cement detail', () => {
    expect(DEFAULT_WELL_SETUP.casings.some((c) => Number.isFinite(c.cementSacks))).toBe(true);
  });
});
```

- [ ] **Step 2:** `corepack pnpm --filter @valor/core test field-defs` → FAIL.
- [ ] **Step 3: Implement** — in `types.ts`, add cement fields to `CasingRow` and the new interfaces, and extend `WellSetup` + `WellboreModel`:

```ts
// add to CasingRow:
  cementSacks?: number; cementLeadPpg?: number; cementTailPpg?: number;

export interface TubingRow {
  odIn: number; idIn: number; weightPpf: number; grade: string; connection: string;
  hangerDepthFt: number; shoeDepthFt: number;
}
export type CompletionType = 'perforation' | 'packer' | 'sssv' | 'screen' | 'sliding_sleeve' | 'gas_lift_mandrel';
export interface CompletionRow { id: string; type: CompletionType; name: string; topFt: number; bottomFt?: number; shotsPerFt?: number; }
export interface WellheadInfo { workingPressurePsi?: number; tubingHeadSize?: string; casingHeadSize?: string; treeType?: string; }

// add to WellSetup:
  tubing?: TubingRow; completions?: CompletionRow[]; wellhead?: WellheadInfo;
// add to WellboreModel:
  tubing?: TubingRow; completions: CompletionRow[]; wellhead?: WellheadInfo;
```

In `field-defs.ts` add the registries + extend `CASING_COLUMNS` + `DEFAULT_WELL_SETUP`:

```ts
import type { CompletionType } from './types';

export const COMPLETION_TYPES: { value: CompletionType; label: string }[] = [
  { value: 'perforation', label: 'Perforation' },
  { value: 'packer', label: 'Packer' },
  { value: 'sssv', label: 'SSSV' },
  { value: 'screen', label: 'Screen' },
  { value: 'sliding_sleeve', label: 'Sliding Sleeve' },
  { value: 'gas_lift_mandrel', label: 'Gas-Lift Mandrel' },
];

export const TUBING_FIELDS: ColumnSpec[] = [
  { key: 'odIn', label: 'OD', kind: 'number', unitQuantity: 'length' },
  { key: 'idIn', label: 'ID', kind: 'number', unitQuantity: 'length' },
  { key: 'weightPpf', label: 'Weight (lb/ft)', kind: 'number' },
  { key: 'grade', label: 'Grade', kind: 'text' },
  { key: 'connection', label: 'Connection', kind: 'text' },
  { key: 'hangerDepthFt', label: 'Hanger depth', kind: 'number', unitQuantity: 'length' },
  { key: 'shoeDepthFt', label: 'Shoe depth', kind: 'number', unitQuantity: 'length' },
];

export const COMPLETION_COLUMNS: ColumnSpec[] = [
  { key: 'name', label: 'Name', kind: 'text' },
  { key: 'topFt', label: 'Top', kind: 'number', unitQuantity: 'length' },
  { key: 'bottomFt', label: 'Bottom', kind: 'number', unitQuantity: 'length' },
  { key: 'shotsPerFt', label: 'Shots/ft', kind: 'number' },
];

export const WELLHEAD_FIELDS: { key: keyof import('./types').WellheadInfo; label: string; kind: 'number' | 'text' }[] = [
  { key: 'workingPressurePsi', label: 'Working pressure (psi)', kind: 'number' },
  { key: 'tubingHeadSize', label: 'Tubing head size', kind: 'text' },
  { key: 'casingHeadSize', label: 'Casing head size', kind: 'text' },
  { key: 'treeType', label: 'Tree type', kind: 'text' },
];
```

Append cement columns to `CASING_COLUMNS` (after `tocFt`):

```ts
  { key: 'cementSacks', label: 'Cement (sx)', kind: 'number' },
  { key: 'cementLeadPpg', label: 'Lead (ppg)', kind: 'number' },
  { key: 'cementTailPpg', label: 'Tail (ppg)', kind: 'number' },
```

Extend `DEFAULT_WELL_SETUP` (add cement detail to the Production casing row + the new groups):

```ts
  // on the Production casing row, add: cementSacks: 765, cementLeadPpg: 12.5, cementTailPpg: 15.7
  tubing: { odIn: 2.875, idIn: 2.441, weightPpf: 6.5, grade: 'L-80', connection: 'EUE', hangerDepthFt: 0, shoeDepthFt: 6300 },
  completions: [
    { id: 'comp-1', type: 'sssv', name: 'Surface Safety Valve', topFt: 1000 },
    { id: 'comp-2', type: 'packer', name: 'Production Packer', topFt: 6280 },
    { id: 'comp-3', type: 'perforation', name: 'Target Sand Perfs', topFt: 6100, bottomFt: 6380, shotsPerFt: 6 },
  ],
  wellhead: { workingPressurePsi: 5000, tubingHeadSize: '11 in', casingHeadSize: '13-5/8 in', treeType: 'Conventional' },
```

- [ ] **Step 4:** test → PASS. **Step 5:** Commit `feat(core): well-setup tubing/completions/cement/wellhead model + registries + seed`.

## Task 2: `projectWellbore` carries the new elements

**Files:** Modify `packages/core/src/well-setup/project-wellbore.ts`; add tests to `project-wellbore.test.ts`

- [ ] **Step 1: Failing test**

```ts
it('carries tubing, sorted completions, and wellhead', () => {
  const m = projectWellbore(DEFAULT_WELL_SETUP);
  expect(m.tubing?.odIn).toBeGreaterThan(0);
  expect(m.wellhead?.workingPressurePsi).toBeGreaterThan(0);
  const tops = m.completions.map((c) => c.topFt);
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
});
it('defaults completions to [] when absent (back-compat)', () => {
  const bare = structuredClone(DEFAULT_WELL_SETUP);
  delete (bare as { completions?: unknown }).completions;
  delete (bare as { tubing?: unknown }).tubing;
  const m = projectWellbore(bare);
  expect(m.completions).toEqual([]);
  expect(m.tubing).toBeUndefined();
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — in `projectWellbore`, after the existing sorts, add:

```ts
  const completions = [...(setup.completions ?? [])].sort((a, b) => a.topFt - b.topFt);
```

and add `tubing: setup.tubing, completions, wellhead: setup.wellhead,` to the returned `WellboreModel`.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(core): projectWellbore carries tubing/completions/wellhead`.

## Task 3: Panels — grouped input sections

**Files:** Modify `apps/web/components/well-setup-panels.tsx`; add tests to `apps/web/__tests__/well-setup-panels.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
it('renders a completions section and edits a completion name', () => {
  const onChange = vi.fn();
  const { getAllByLabelText, getByText } = render(
    <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="in" />,
  );
  expect(getByText(/Completions/i)).toBeTruthy();
  // Tubing + Wellhead groups present
  expect(getByText(/Tubing/i)).toBeTruthy();
  expect(getByText(/Wellhead/i)).toBeTruthy();
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — extend the panels:
  - **Casing table** auto-gains the cement columns (`CASING_COLUMNS` extended) — verify they render and are NOT unit-converted (cementSacks/Lead/Tail are plain numbers, no `unitQuantity`). The existing `renderCellInput` already handles non-length numbers.
  - **Tubing** card: render `TUBING_FIELDS` as a single-row group editing `setup.tubing` (default to a blank tubing object if `undefined`); number fields convert via `convertLength` when `unitQuantity==='length'` (use `diaUnit` for OD/ID, `depthUnit` for hanger/shoe).
  - **Completions** card: a repeatable table — a **type `<select>`** over `COMPLETION_TYPES` plus `COMPLETION_COLUMNS` cells; add row appends `{ id: \`comp-${n}\`, type: 'perforation', name: '', topFt: 0 }` (id from max existing comp-N + 1, no `Date.now()`); editing updates `setup.completions ?? []`.
  - **Wellhead** card: render `WELLHEAD_FIELDS` as inline inputs editing `setup.wellhead` (default `{}` if undefined).
  - Keep the established input styling; each new control has an associated label. Use `?? []`/`?? {}` for back-compat.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): grouped tubing/completions/cement/wellhead inputs`.

## Task 4: Schematic — render the new elements

**Files:** Modify `apps/web/components/wellbore-schematic.tsx`; add tests to `apps/web/__tests__/wellbore-schematic.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
it('renders tubing, a perforation, and a wellhead element', () => {
  const model = projectWellbore(DEFAULT_WELL_SETUP);
  const { container, getByText } = render(<WellboreSchematic model={model} depthUnit="ft" diaUnit="in" />);
  expect(container.querySelector('[data-testid="tubing"]')).toBeTruthy();
  expect(container.querySelector('[data-testid="completion-perforation"]')).toBeTruthy();
  expect(container.querySelector('[data-testid="wellhead"]')).toBeTruthy();
  expect(getByText(/Target Sand Perfs/)).toBeTruthy();
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — add to the SVG (using the existing `yOf`/`CENTER_X`/`halfWidthOf` helpers):
  - **Tubing** (`data-testid="tubing"`): a thin inner double-line from `yOf(hangerDepthFt)` to `yOf(shoeDepthFt)` at a small half-width inside the innermost casing; label "TBG OD × weight × grade".
  - **Cement**: where a casing has `cementSacks`/`tocFt`, shade the annulus from shoe up to `yOf(tocFt)` (lead/tail hatch or two-tone); a small "cmt N sx" label.
  - **Completions** (`g` per item, `data-testid={"completion-"+type}`): **perforation** = a hatched/zig band on both casing walls over `[topFt,bottomFt]`; **packer** = a filled bar across the tubing-casing annulus at `topFt`; **sssv** = a small valve glyph on the tubing at `topFt`; others = a labeled tick. Each labeled on the right rail with name + interval.
  - **Wellhead** (`data-testid="wellhead"`): a compact stacked-spool/tree glyph centered at the top (above `bodyTop`) with a "WP {workingPressurePsi} psi" label.
  - All print-clean (solid/hatch, brand tokens). Guard every element on its data being present + finite.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): schematic renders tubing/cement/completions/wellhead`.

## Task 5: Integrate, verify, ship

- [ ] core `test`+`typecheck`, web `test`+`typecheck`+`build` all green (the page needs no change — panels + schematic flow from the extended model).
- [ ] Restart server; capture the enriched `/wells/well-lf1/setup` (+ schematic close-up); send for punchlist.
- [ ] Push `feat/well-setup-completion`; open PR (base `master`); action bots per max-adherence; merge on clean review.

## Self-Review
- **Spec coverage:** model+registries+seed (§1 ✓ T1), projection (§1 ✓ T2), grouped inputs (§2 ✓ T3), schematic render (§2 ✓ T4), DoD (§4 ✓ T5).
- **Type consistency:** `TubingRow`/`CompletionRow`/`CompletionType`/`WellheadInfo`/`CASING_COLUMNS` cement keys / `COMPLETION_*`/`TUBING_FIELDS`/`WELLHEAD_FIELDS` / `WellboreModel.tubing|completions|wellhead` consistent; all optional/back-compat.
- **No placeholders:** core steps carry full code; web steps carry signatures, `data-testid` contracts, and tests.
