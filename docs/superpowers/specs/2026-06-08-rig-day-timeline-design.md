# Rig Day Timeline — Design Spec (slice 4a of the operator console)

**Status:** draft for b.jones review · **Date:** 2026-06-08 · **Branch:** `feat/rig-day-console`

**Goal:** A **live execution log** — **coded activity blocks** placed on a **24-hr / 5-min timeline**,
with **live time-accounting** (hours-by-activity, **NPT**, unaccounted gaps) derived for free. The
first, demonstrable increment of the Rig Day operator console: *log the day in coded blocks, watch the
analytics fall out.*

**Non-goals (later increments):** the people/equipment/progress **swimlanes**, the **Recall & QC
pull-up**, **reminders/notifications**, the **EDR activity auto-feed**, and multi-day calendar. This
slice is frontend-first on the mock adapter; every seam is shaped for those.

**Grounds in shipped work:** reuses the **Bank** (`BANK_SEED` coded activity catalog with `npt`/
`billable` flags) and the repository seam from slice 1. Same `pure-core → registry-driven UI →
repository` shape as `computeHydraulics` / `projectWellbore`.

---

## 1. Architecture

```
 Bank palette ─▶ add coded block ─┐
 Block editors (start/end/code) ──┼─▶ RigDay.blocks ─▶ deriveTimeAccounting() ─▶ Accounting rail
 Timeline (render + now-marker) ◀─┘        (pure @valor/core)        (hours-by-code · NPT · gaps)
        persisted via Repository.saveRigDay / loadRigDay (mock/localStorage now)
```

- **Pure core:** `TimeBlock` / `RigDay` types + `snapTo5` + **`deriveTimeAccounting(blocks, nowMin)`**
  (joins the Bank, sums minutes by code, computes NPT/productive split + unaccounted gaps; never
  throws — returns `warnings`). This is summation, **not advanced math** (per the simplicity guardrail).
- **Repository seam:** `saveRigDay(id, day)` / `loadRigDay(id)` mirroring `saveWellSetup`/`loadWellSetup`.
- **Web:** a `/rig-day` screen — timeline render + Bank palette + per-block editors + a live
  time-accounting rail. Valor brand; block color from the Bank category.

## 2. Core types (`packages/core/src/rig-day/`)

```ts
export interface TimeBlock {
  id: string;
  code: string;          // FK → Bank (BankCode.code)
  startMin: number;      // minutes from rig-day start, 0..1440, 5-min snapped
  endMin: number;        // > startMin, 5-min snapped, clamp ≤ 1440
  depthStartFt?: number;
  depthEndFt?: number;
  note?: string;
}
export interface RigDay { id: string; label: string; blocks: TimeBlock[]; }

export interface CodeTally {
  code: string; label: string; category: string; minutes: number; npt: boolean; billable: boolean;
}
export interface TimeAccounting {
  totalLoggedMin: number;
  productiveMin: number;
  nptMin: number;
  byCode: CodeTally[];                                   // desc by minutes
  unaccountedGaps: { startMin: number; endMin: number }[]; // within [0, nowMin]
  warnings: string[];                                    // overlaps, unknown codes, inverted spans
}

export const DAY_MINUTES = 1440;
```

## 3. Pure functions

- **`snapTo5(min): number`** — clamp to `[0, DAY_MINUTES]`, round to nearest 5.
- **`deriveTimeAccounting(blocks, nowMin?): TimeAccounting`**
  - Sort by `startMin`. For each: `dur = max(0, endMin - startMin)`; resolve `findBankCode(code)`
    (unknown → warning, treated as non-NPT/non-billable, label = code).
  - Accumulate `byCode[code].minutes += dur`; `nptMin += dur` when the code is `npt`;
    `productiveMin = totalLoggedMin - nptMin`.
  - **Overlap** (`block.startMin < prev.endMin`) → warning; **inverted** (`endMin ≤ startMin`) → warning.
  - **`unaccountedGaps`**: merge block intervals, then list gaps within `[0, nowMin]` (default
    `nowMin` = max `endMin`, i.e. "now" = end of the last logged block).
  - `byCode` sorted by minutes desc.

## 4. Repository seam (mock)

Add to `Repository` + `MockRepository` (localStorage `valor:rigday:{id}` + in-memory `Map` fallback,
exactly like well-setup): `saveRigDay(id, day)` / `loadRigDay(id): RigDay | null`. A `DEFAULT_RIG_DAY`
seed (generic, brand-free) with ~6 blocks spanning a believable shift, **including one NPT block**
(e.g. `RIGREP`), so the accounting rail is non-trivial on first load.

## 5. Web — `/rig-day` (`apps/web/app/(hub)/rig-day/page.tsx`)

`'use client'`: `loadRigDay('demo')` (fallback `DEFAULT_RIG_DAY`); hold `day` in state; derive
`accounting = deriveTimeAccounting(day.blocks)`. Layout:

- **Timeline** (`<RigDayTimeline>`): a horizontal 24-hr track; hour gridlines + 5-min minor ticks; each
  block a positioned bar (`left = startMin/1440`, `width = dur/1440`), **colored by Bank category**,
  labeled with the code; a **"now" marker** at `max(endMin)`. Print-clean.
- **Bank palette** (`<BankPalette>`): a searchable list of `BANK_SEED` grouped by category; clicking a
  code **appends** a new 30-min block (snapped) after the last block → updates `day`. (This is "search
  the bank to create"; full drag-to-create is a later refinement.)
- **Per-block editors**: each block row shows code (`<select>` over the Bank), start/end (number inputs,
  `onBlur` → `snapTo5`), and a remove button. Editing recomputes accounting live.
- **"Rig Now" strip**: the block covering `now` (or the latest) shown large — code · elapsed · depth.
- **Accounting rail** (`<TimeAccountingRail>`): `byCode` as horizontal bars (NPT bars in the red accent),
  headline totals (productive vs **NPT** hours), and an **unaccounted** chip when gaps exist. This is the
  morning-report seed — derived, zero double-entry.
- **Save** → `saveRigDay`. Warnings rendered like the hydraulics/well-setup panels.

## 6. Files

- `packages/core/src/rig-day/types.ts`, `time-accounting.ts` (snap + derive), `seed.ts`
  (`DEFAULT_RIG_DAY`) + tests; repo seam edits in `repository.ts`/`mock-repository.ts`; `index.ts` export.
- `apps/web/components/rig-day-timeline.tsx`, `bank-palette.tsx`, `time-accounting-rail.tsx`,
  `rig-day-editors.tsx`; `apps/web/app/(hub)/rig-day/page.tsx`; a "Rig Day" nav link in `app-shell.tsx`.
- Tests: core (snap, derive: byCode sums, NPT split, gaps, overlap warning) + web RTL (palette adds a
  block; editing start/end recomputes; rail shows NPT).

## 7. Definition of done

Open `/rig-day`, see a coded day on the 24-hr/5-min timeline, **add a block from the Bank**, edit its
span, and watch the **time-accounting rail recompute live** (hours-by-activity, **NPT**, unaccounted) —
all on the mock adapter, in the Valor brand, on the live link. Seams (swimlanes, pull-up, notifications,
EDR feed) shaped for the next increments without rework.

## 8. Review

Through the standard pipeline (gates 1–8) + dual-bot PR review with **max adherence** (action every
finding by default). PR base = `master`.
