# Office Ops (Vendors + AFE/Cost) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Activate Office Ops with a Vendors & Contacts directory + an AFE/Cost table with a budget-vs-actual rollup.

**Architecture:** Pure `@valor/core` `office-ops` module (vendor/AFE types + seeds + `summarizeAfe`) + repo seam; web adds three components + activates the workspace. Mirrors the shipped data-manager/well-setup pattern.

**Spec:** `docs/superpowers/specs/2026-06-08-office-ops-design.md`

**Conventions:** extensionless imports; pure fns never throw; no `Date.now()`/`Math.random()` in core; repo persistence mirrors `saveWellSetup`; add exports to `index.ts`.

---

## Task 1: Types + seeds + `summarizeAfe`

**Files:** Create `packages/core/src/office-ops/types.ts`, `office-ops/vendors.ts`, `office-ops/afe.ts`, `packages/core/test/office-ops.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_VENDORS, blankVendor, VENDOR_CATEGORIES } from '../src/office-ops/vendors';
import { DEFAULT_AFE, blankAfeLine, summarizeAfe } from '../src/office-ops/afe';

describe('office-ops', () => {
  it('vendor seed has unique ids + a known category', () => {
    expect(new Set(DEFAULT_VENDORS.map((v) => v.id)).size).toBe(DEFAULT_VENDORS.length);
    expect(VENDOR_CATEGORIES).toContain('Mud');
  });
  it('summarizeAfe totals budget/actual/variance', () => {
    const s = summarizeAfe([
      { id: 'a', code: '1', description: 'x', category: 'Drilling', budget: 100, actual: 120 },
      { id: 'b', code: '2', description: 'y', category: 'Mud', budget: 50, actual: 40 },
    ]);
    expect(s.totalBudget).toBe(150);
    expect(s.totalActual).toBe(160);
    expect(s.variance).toBe(-10);
    expect(s.byCategory.find((c) => c.category === 'Drilling')?.variance).toBe(-20);
  });
  it('summarizeAfe treats non-finite as 0', () => {
    const s = summarizeAfe([{ id: 'a', code: '1', description: 'x', category: 'Drilling', budget: NaN, actual: 10 }]);
    expect(s.totalBudget).toBe(0); expect(s.totalActual).toBe(10);
  });
  it('blanks are deterministic by seq', () => {
    expect(blankVendor(2).id).toBe('v-2'); expect(blankAfeLine(3).id).toBe('afe-3');
  });
});
```

- [ ] **Step 2:** `corepack pnpm --filter @valor/core test office-ops` → FAIL.
- [ ] **Step 3: Implement** `types.ts`:

```ts
export type VendorStatus = 'active' | 'pending' | 'inactive';
export interface Contact { name: string; role: string; phone?: string; email?: string; }
export interface Vendor { id: string; name: string; category: string; status: VendorStatus; contacts: Contact[]; note?: string; }
export interface AfeLine { id: string; code: string; description: string; category: string; budget: number; actual: number; }
export interface AfeCategoryRoll { category: string; budget: number; actual: number; variance: number; }
export interface AfeSummary { totalBudget: number; totalActual: number; variance: number; byCategory: AfeCategoryRoll[]; }
export const VENDOR_STATUSES: VendorStatus[] = ['active', 'pending', 'inactive'];
export const VENDOR_CATEGORIES: string[] = ['Drilling', 'Mud', 'Cement', 'Wireline', 'Directional', 'Logistics', 'Inspection', 'Rental', 'Other'];
export const AFE_CATEGORIES: string[] = ['Drilling', 'Mud', 'Cement', 'Directional', 'Tubulars', 'Wireline', 'Logistics', 'Other'];
```

`vendors.ts`:

```ts
import type { Vendor } from './types';
export { VENDOR_STATUSES, VENDOR_CATEGORIES } from './types';

export const DEFAULT_VENDORS: Vendor[] = [
  { id: 'v-1', name: 'Drilling Contractor Inc.', category: 'Drilling',    status: 'active',  contacts: [{ name: 'Rig Manager', role: 'Operations', phone: '555-0101' }] },
  { id: 'v-2', name: 'Mud Services Co.',          category: 'Mud',         status: 'active',  contacts: [{ name: 'Mud Engineer', role: 'Field', phone: '555-0102' }] },
  { id: 'v-3', name: 'Cementing Partners',        category: 'Cement',      status: 'active',  contacts: [{ name: 'Cement Supervisor', role: 'Field', phone: '555-0103' }] },
  { id: 'v-4', name: 'Directional Services',      category: 'Directional', status: 'active',  contacts: [{ name: 'DD Coordinator', role: 'Office', phone: '555-0104' }] },
  { id: 'v-5', name: 'Wireline & Logging',        category: 'Wireline',    status: 'pending', contacts: [{ name: 'Field Engineer', role: 'Field', phone: '555-0105' }] },
  { id: 'v-6', name: 'Inspection Group',          category: 'Inspection',  status: 'active',  contacts: [{ name: 'Lead Inspector', role: 'QA', phone: '555-0106' }] },
];

export function blankVendor(seq: number): Vendor {
  return { id: `v-${seq}`, name: '', category: 'Other', status: 'pending', contacts: [], note: '' };
}
```

`afe.ts`:

```ts
import type { AfeLine, AfeSummary, AfeCategoryRoll } from './types';
export { AFE_CATEGORIES } from './types';

export const DEFAULT_AFE: AfeLine[] = [
  { id: 'afe-1', code: '100', description: 'Rig Day Rate',        category: 'Drilling',    budget: 450000, actual: 470000 },
  { id: 'afe-2', code: '200', description: 'Drilling Fluids',     category: 'Mud',         budget: 120000, actual: 115000 },
  { id: 'afe-3', code: '300', description: 'Cementing',           category: 'Cement',      budget: 85000,  actual: 90000 },
  { id: 'afe-4', code: '400', description: 'Directional Services',category: 'Directional', budget: 160000, actual: 158000 },
  { id: 'afe-5', code: '500', description: 'Casing & Tubulars',   category: 'Tubulars',    budget: 220000, actual: 210000 },
  { id: 'afe-6', code: '600', description: 'Wireline / Logging',  category: 'Wireline',    budget: 60000,  actual: 0 },
  { id: 'afe-7', code: '700', description: 'Bits',                category: 'Drilling',    budget: 45000,  actual: 52000 },
  { id: 'afe-8', code: '800', description: 'Logistics & Trucking',category: 'Logistics',   budget: 35000,  actual: 38000 },
];

export function blankAfeLine(seq: number): AfeLine {
  return { id: `afe-${seq}`, code: '', description: '', category: 'Other', budget: 0, actual: 0 };
}

export function summarizeAfe(lines: AfeLine[]): AfeSummary {
  const num = (n: number) => (Number.isFinite(n) ? n : 0);
  const byCat = new Map<string, AfeCategoryRoll>();
  let totalBudget = 0, totalActual = 0;
  for (const l of lines) {
    const b = num(l.budget), a = num(l.actual);
    totalBudget += b; totalActual += a;
    const r = byCat.get(l.category) ?? { category: l.category, budget: 0, actual: 0, variance: 0 };
    r.budget += b; r.actual += a; r.variance = r.budget - r.actual;
    byCat.set(l.category, r);
  }
  return { totalBudget, totalActual, variance: totalBudget - totalActual, byCategory: [...byCat.values()].sort((x, y) => y.budget - x.budget) };
}
```

- [ ] **Step 4:** test → PASS. **Step 5:** Commit `feat(core): office-ops vendor + AFE types, seeds, summarizeAfe`.

## Task 2: Repository seam

**Files:** Modify `repository.ts`, `mock-repository.ts`; Create `packages/core/test/mock-repository.office-ops.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEFAULT_VENDORS } from '../src/office-ops/vendors';
import { DEFAULT_AFE } from '../src/office-ops/afe';

describe('MockRepository office-ops', () => {
  it('null before save', async () => {
    const r = new MockRepository();
    expect(await r.loadVendors()).toBeNull();
    expect(await r.loadAfe()).toBeNull();
  });
  it('round-trips vendors + afe', async () => {
    const r = new MockRepository();
    await r.saveVendors(DEFAULT_VENDORS); await r.saveAfe(DEFAULT_AFE);
    expect((await r.loadVendors())?.length).toBe(DEFAULT_VENDORS.length);
    expect((await r.loadAfe())?.length).toBe(DEFAULT_AFE.length);
  });
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — add to `Repository`:

```ts
saveVendors(vendors: import('./office-ops/types').Vendor[]): Promise<void>;
loadVendors(): Promise<import('./office-ops/types').Vendor[] | null>;
saveAfe(lines: import('./office-ops/types').AfeLine[]): Promise<void>;
loadAfe(): Promise<import('./office-ops/types').AfeLine[] | null>;
```

In `MockRepository` (mirror `saveChannels`, keys `valor:vendors` / `valor:afe`, with `private vendors`/`private afe` in-memory fallbacks). Use a small generic helper or repeat the localStorage+Map pattern for each.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(core): repository seam for vendors + AFE`.

## Task 3: Export

**Files:** Modify `packages/core/src/index.ts`

- [ ] Add `export * from './office-ops/types';`, `export * from './office-ops/vendors';`, `export * from './office-ops/afe';`. Run full core `test` + `typecheck` (green). Commit `feat(core): export office-ops`.

## Task 4: `<VendorDirectory>`, `<AfeTable>`, `<AfeSummaryStrip>`

**Files:** Create `apps/web/components/vendor-directory.tsx`, `afe-table.tsx`, `afe-summary-strip.tsx`, and tests `apps/web/__tests__/office-ops.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DEFAULT_VENDORS, DEFAULT_AFE, summarizeAfe } from '@valor/core';
import { VendorDirectory } from '@/components/vendor-directory';
import { AfeTable } from '@/components/afe-table';
import { AfeSummaryStrip } from '@/components/afe-summary-strip';

it('vendor directory edits a name + filters by search', () => {
  const onChange = vi.fn();
  const { getAllByTestId, getAllByLabelText, getByLabelText } = render(<VendorDirectory vendors={DEFAULT_VENDORS} onChange={onChange} />);
  fireEvent.change(getAllByLabelText(/Vendor name/i)[0], { target: { value: 'New Co.' } });
  expect(onChange).toHaveBeenCalled();
  fireEvent.change(getByLabelText(/search/i), { target: { value: 'Mud' } });
  expect(getAllByTestId('vendor-row').length).toBe(1);
});
it('afe table edits a budget', () => {
  const onChange = vi.fn();
  const { getAllByLabelText } = render(<AfeTable lines={DEFAULT_AFE} onChange={onChange} />);
  fireEvent.change(getAllByLabelText(/Budget/i)[0], { target: { value: '999' } });
  expect(onChange).toHaveBeenCalled();
});
it('summary strip shows totals', () => {
  const { getByText } = render(<AfeSummaryStrip summary={summarizeAfe(DEFAULT_AFE)} />);
  expect(getByText(/Variance/i)).toBeTruthy();
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement**
  - `VendorDirectory({ vendors, onChange })` — search input (`aria-label="Search vendors"`) filters by name/category; table, each visible row `data-testid="vendor-row"`: name (`aria-label="Vendor name"`), category (`<select>` `VENDOR_CATEGORIES`), status (`<select>` `VENDOR_STATUSES`), primary contact name/role/phone (edits `contacts[0]`, creating it if absent), note, remove. Add vendor → `blankVendor(maxSeq+1)`.
  - `AfeTable({ lines, onChange })` — table, each row `data-testid="afe-row"`: code, description, category (`<select>` `AFE_CATEGORIES`), budget (number, `aria-label="Budget"`), actual (number). Add line → `blankAfeLine(maxSeq+1)`. Remove.
  - `AfeSummaryStrip({ summary })` — Total Budget / Total Actual / **Variance** (green ≥0, red <0) headline; per-category rows `data-testid="afe-cat"` (budget vs actual bar + variance). Currency-format with `toLocaleString`.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): vendor directory + AFE table + summary strip`.

## Task 5: `/office-ops` page + activate + nav

**Files:** Create `apps/web/app/(hub)/office-ops/page.tsx`; modify `apps/web/lib/areas.ts`, `apps/web/components/app-shell.tsx`; delete `apps/web/app/(areas)/office-ops/page.tsx`

- [ ] **Step 1: Implement**
  - `lib/areas.ts`: `office-ops` → `status: 'active'`.
  - Delete `app/(areas)/office-ops/page.tsx`.
  - `app/(hub)/office-ops/page.tsx` (`'use client'`): load vendors + afe (`getRepo().loadVendors()`/`loadAfe()`, fallback seeds); state; `summary = summarizeAfe(afe)`; `PageHeader` ("Office Ops"); `<VendorDirectory>` + `<AfeTable>` + `<AfeSummaryStrip>` in cards; **Save** → `saveVendors`+`saveAfe`; `LoadingState` while loading.
  - `app-shell.tsx`: add an "Office Ops" nav link (Building2 icon).

- [ ] **Step 2:** `corepack pnpm --filter @valor/web build` compiles `/office-ops`; `typecheck` 0. **Step 3:** Commit `feat(web): office-ops page + activate workspace`.

## Task 6: Integrate, verify, ship

- [ ] core `test`+`typecheck`, web `test`+`typecheck`+`build` all green.
- [ ] Restart server; capture `/office-ops` + launcher; send for punchlist.
- [ ] Push `feat/office-ops`; open PR (base `master`); action bots per max-adherence; merge on clean review.

## Self-Review
- **Spec coverage:** types/seeds/summarizeAfe (§1 ✓ T1), repo (§1 ✓ T2), components (§2 ✓ T4), page+activate (§2 ✓ T5), DoD (§4 ✓ T6).
- **Type consistency:** `Vendor`/`AfeLine`/`AfeSummary`/`summarizeAfe`/`DEFAULT_*`/`blank*`/`save*`/`load*` consistent.
- **No placeholders:** core steps carry full code; web steps carry signatures, `data-testid`/`aria-label` contracts, and tests.
