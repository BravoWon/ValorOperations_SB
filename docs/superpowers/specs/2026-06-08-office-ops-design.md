# Office Ops — Vendors + AFE/Cost — Design Spec

**Status:** draft for b.jones review · **Date:** 2026-06-08 · **Branch:** `feat/office-ops`

**Goal:** Activate the **Office Ops** (back-office consolidation) workspace with its two core surfaces:
a **Vendors & Contacts** directory and **AFE/Cost** tracking with a **budget-vs-actual rollup**. Both
are coded-object tables on the same engine; the AFE summary makes the *calculation* first-class
(budget, actual, variance — not just a list a human eyeballs).

**Non-goals (later):** scheduling/logistics, document consolidation, invoicing/PO. Mock adapter for now.

---

## 1. Core (`packages/core/src/office-ops/`)

```ts
// Vendors & contacts
export type VendorStatus = 'active' | 'pending' | 'inactive';
export interface Contact { name: string; role: string; phone?: string; email?: string; }
export interface Vendor { id: string; name: string; category: string; status: VendorStatus; contacts: Contact[]; note?: string; }
export const VENDOR_CATEGORIES: string[];   // Drilling, Mud, Cement, Wireline, Directional, Logistics, Inspection, Rental, Other
export const VENDOR_STATUSES: VendorStatus[];
export const DEFAULT_VENDORS: Vendor[];      // ~6 generic vendors, brand-free (e.g. "Mud Services Co.")
export function blankVendor(seq: number): Vendor;

// AFE / cost
export interface AfeLine { id: string; code: string; description: string; category: string; budget: number; actual: number; }
export const DEFAULT_AFE: AfeLine[];          // ~8 generic AFE lines
export function blankAfeLine(seq: number): AfeLine;

export interface AfeCategoryRoll { category: string; budget: number; actual: number; variance: number; }
export interface AfeSummary { totalBudget: number; totalActual: number; variance: number; byCategory: AfeCategoryRoll[]; }
export function summarizeAfe(lines: AfeLine[]): AfeSummary; // variance = budget - actual; rolled by category, sorted by budget desc
```

`summarizeAfe` is pure (never throws; non-finite budget/actual treated as 0). Seeds are generic/
brand-free. Repo seam: `saveVendors`/`loadVendors`, `saveAfe`/`loadAfe` (localStorage `valor:vendors`,
`valor:afe` + in-memory `Map` fallback, mirroring `saveWellSetup`).

## 2. Web

- **Activate Office Ops:** in `lib/areas.ts`, set `office-ops` `status: 'active'`; delete the coming-soon
  `app/(areas)/office-ops/page.tsx`; new screen at `app/(hub)/office-ops/page.tsx`; nav link.
- **`<VendorDirectory>`** — editable table over `Vendor[]`: name, category (`<select>`), status
  (`<select>`), a contacts count + first contact name/role/phone editable inline (keep it to the primary
  contact for v1; full contact list is a later refinement), note; add/remove; **search** by name/category.
  `data-testid="vendor-row"`.
- **`<AfeTable>`** — editable table over `AfeLine[]`: code, description, category (`<select>`), budget,
  actual; add/remove. `data-testid="afe-row"`.
- **`<AfeSummaryStrip>`** — headline **Total Budget / Total Actual / Variance** (variance green when ≥0,
  red when over) + per-category bars (`data-testid="afe-cat"`), from `summarizeAfe`.
- **`/office-ops` page** (`'use client'`): load vendors + AFE via the repo (fallback seeds), state,
  `PageHeader` ("Office Ops"), the three components in cards, a **Save** button → `saveVendors`+`saveAfe`,
  `LoadingState` while loading.

## 3. Files

- Core: `office-ops/types.ts`, `office-ops/vendors.ts` (`DEFAULT_VENDORS`, `VENDOR_*`, `blankVendor`),
  `office-ops/afe.ts` (`DEFAULT_AFE`, `blankAfeLine`, `summarizeAfe`); repo seam; `index.ts` export; tests
  (summarizeAfe totals/variance/by-category; seeds integrity; blanks deterministic; repo round-trip).
- Web: `components/vendor-directory.tsx`, `components/afe-table.tsx`, `components/afe-summary-strip.tsx`,
  `app/(hub)/office-ops/page.tsx`; `lib/areas.ts` (+ remove the `(areas)/office-ops` route);
  `components/app-shell.tsx` nav; RTL tests (vendor edit fires onChange; AFE edit; summary shows totals;
  search filters).

## 4. Definition of done

Launcher shows **Office Ops** live; open it → a **Vendors & Contacts** directory and an **AFE/Cost**
table with a live **budget‑vs‑actual variance** rollup; edit/add/remove/search and **Save** — all on the
mock adapter, in the Valor brand, on the live link.

## 5. Review

Standard pipeline (gates 1–8) + dual-bot PR review with **max adherence**. PR base = `master`.
