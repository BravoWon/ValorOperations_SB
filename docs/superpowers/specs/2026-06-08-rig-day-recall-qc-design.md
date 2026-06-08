# Rig Day Recall & QC Pull-up — Design Spec (slice 4c)

**Status:** draft for b.jones review · **Date:** 2026-06-08 · **Branch:** `feat/rig-day-recall-qc`

**Goal:** Finish the operator console with the **Recall & QC pull-up** — select any activity block and a
bottom drawer surfaces **like-items from other days/wells** (same coded activity) for one-tap **reuse**
(copy-forward depth/note) and **QC** (approve / flag + note). The contextual knowledge layer:
*"not just search the bank — here's how this was done before; pull it in or QC it."* (Support-desk
"related + KB" as a **mental model only** — purpose-built, not an integration.)

**Non-goals (later):** reminders/notifications, EDR auto-feed, cross-instance/real history (the recall
corpus is a seeded library on the mock adapter for now). Frontend-first.

**Grounds in shipped work:** reuses the Bank codes + the `TimeBlock` model; the drawer is additive to
the `/rig-day` console.

---

## 1. Core (`packages/core/src/rig-day/`)

A historical block reference (the recall corpus) + a QC mark on a block:

```ts
export interface RecallItem {
  id: string; code: string; label: string;   // code = Bank code; label = activity label
  wellLabel: string; dayLabel: string;        // generic provenance, e.g. "Well B", "Day 3"
  startMin: number; endMin: number;
  depthStartFt?: number; depthEndFt?: number;
  note?: string;
}
export const RECALL_LIBRARY: RecallItem[];     // ~12 generic items across 2-3 wells/days, varied codes
export function findLikeItems(code: string, library?: RecallItem[]): RecallItem[]; // same code

// QC mark on a block (additive, back-compat — older blocks have no qc):
export type QcStatus = 'approved' | 'flagged';
export interface QcMark { status: QcStatus; note?: string; }
// TimeBlock gains: qc?: QcMark;
```

`findLikeItems` returns same-`code` library entries (sorted by `wellLabel`/`dayLabel` for stability).
`RECALL_LIBRARY` is generic/brand-free (no real well/personnel names). `deriveTimeAccounting` is
unaffected — `qc` is metadata.

## 2. Web

- **`<RecallDrawer>`** — a fixed bottom pull-up (slides up when a block is selected). Props
  `{ block: TimeBlock | null; onReuse: (item: RecallItem) => void; onQc: (qc: QcMark | undefined) => void; onClose: () => void }`. Contents:
  - **Header:** the selected block (code · label · span · depth) + a close button.
  - **QC controls:** **Approve** / **Flag** toggle (sets `block.qc.status`) + a note input; "Clear QC".
  - **Like-items list:** `findLikeItems(block.code)` rendered as rows (provenance `wellLabel · dayLabel`,
    span, depth, note) each with a **Reuse** button → `onReuse(item)` copies the item's
    `depthStartFt/depthEndFt` + `note` onto the selected block (a copy-forward; span unchanged). Empty
    state when none.
- **Selection:** clicking a **timeline block** (`<RigDayTimeline>` gains an optional `onSelect(id)`) OR a
  per-row **"Recall / QC"** button in `<RigDayEditors>` sets `selectedBlockId` on the page; the drawer
  opens for that block. A **QC badge** (green check / red flag) renders on the block in the timeline and
  the editor row when `qc` is set.
- **Page wiring (`/rig-day`):** hold `selectedBlockId`; render `<RecallDrawer>` with the resolved block;
  `onReuse`/`onQc` update that block in `day.blocks` (immutably) and persist via the existing Save.

## 3. Files

- Core: `rig-day/recall.ts` (`RecallItem`, `RECALL_LIBRARY`, `findLikeItems`), extend `rig-day/types.ts`
  (`QcStatus`/`QcMark`, `TimeBlock.qc?`); export from `index.ts`; tests (library codes resolve in the
  Bank, `findLikeItems` filters by code, QC type round-trips a block).
- Web: `components/recall-drawer.tsx`; extend `components/rig-day-timeline.tsx` (`onSelect`, QC badge) +
  `components/rig-day-editors.tsx` (Recall/QC button, QC badge) + `app/(hub)/rig-day/page.tsx`; RTL tests
  (drawer lists like-items; Reuse fires onReuse; Approve fires onQc; timeline onSelect fires).

## 4. Definition of done

Open `/rig-day`, click a block → the **Recall & QC drawer** slides up showing **like-items from other
days/wells**; **Reuse** copies a past block's depth/note onto the selected block; **Approve/Flag** marks
it (badge shows on the timeline) — all on the mock adapter, in the Valor brand, on the live link.

## 5. Review

Standard pipeline (gates 1–8) + dual-bot PR review with **max adherence**. PR base = `master`.
