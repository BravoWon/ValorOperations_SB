# Rig Day Swimlanes — Design Spec (slice 4b)

**Status:** draft for b.jones review · **Date:** 2026-06-08 · **Branch:** `feat/rig-day-swimlanes`

**Goal:** Complete the **time-aligned keystone**: below the activity timeline, add **people**,
**equipment**, and **progress** swimlanes sharing the same 24h/5-min axis — so a job that's active on
day 0-1 aligns *what's happening · who's on location · what gear is here · how deep we are* to one
clock. *"From that mentality the rest flows."*

**Structural-simplicity thesis (made literal):** people and equipment are the **same primitive** as an
activity block — a **coded time span** (`LaneItem`). No bespoke schema per lane; the lanes differ only
by which **coded catalog** they draw from. Adding a new party type or gear class is a catalog row, not
new code.

**Non-goals (later increments):** the Recall/QC pull-up, reminders/notifications, the EDR auto-feed,
multi-day calendar. Frontend-first on the mock adapter.

---

## 1. Core (`packages/core/src/rig-day/`)

A generic coded time-span item, reused by both new lanes:

```ts
export interface LaneItem {
  id: string;
  code: string;        // FK → a coded catalog (party role / equipment category)
  label: string;       // free-text name, e.g. "MWD Tech", "Triplex Pump #2"
  startMin: number;    // 5-min snapped
  endMin: number;
}
```

`RigDay` gains two optional lanes (back-compatible — existing saved days lack them):

```ts
export interface RigDay {
  id: string; label: string;
  blocks: TimeBlock[];
  people?: LaneItem[];
  equipment?: LaneItem[];
}
```

**Coded catalogs** (small, generic, brand-free — the "Bank" for these lanes):

```ts
export interface CatalogCode { code: string; label: string; group: string; }
export const PARTY_ROLES: CatalogCode[];        // Operator Rep, Company Man, DD, MWD, Mud Eng,
                                                // Cement Crew, Wireline, Inspector, Visitor, Driver…
                                                // group ∈ 'Operator' | 'Vendor' | 'Service' | 'Visitor'
export const EQUIPMENT_CATEGORIES: CatalogCode[]; // Rig, Mud Pumps, BOP Stack, Tanks/Pits, Power,
                                                  // Wireline Unit, Cement Unit, Tools/BHA…
export function findPartyRole(code: string): CatalogCode | undefined;
export function findEquipmentCategory(code: string): CatalogCode | undefined;
```

**Progress from activity blocks** (no new data entry — derived):

```ts
export interface ProgressPoint { atMin: number; depthFt: number; }
// Walks blocks carrying depthStartFt/depthEndFt → time-ordered depth points (the progress curve).
export function deriveProgress(blocks: TimeBlock[]): ProgressPoint[];
```

Seed: extend `DEFAULT_RIG_DAY` with a few `people` (e.g. DD days/nights, MWD, Mud Eng, an Inspector
window) and `equipment` (Rig full-day, Mud Pumps, a Wireline Unit window) so the lanes are non-trivial
on first load. Repo seam unchanged (`saveRigDay`/`loadRigDay` already persist the whole `RigDay`).

## 2. Web

- **`<RigDayLanes>`** — renders, stacked and sharing the timeline's 24h x-axis (one shared `minToPct`):
  - **Activity** (existing blocks — reuse the timeline bar render).
  - **People** — `LaneItem` bars colored by `PARTY_ROLES` group (operator/vendor/service/visitor),
    labeled with `label` (`code` on hover/aria).
  - **Equipment** — `LaneItem` bars colored by `EQUIPMENT_CATEGORIES` group.
  - **Progress** — a depth-vs-time line/area (SVG path) from `deriveProgress`, depth axis inverted
    (deeper = lower), with a current-depth readout.
  - A shared "now" marker line dropped through all lanes at `max(block.endMin)`.
- **`<LaneEditors>`** — generic add/edit for a `LaneItem[]` (reused for people + equipment): a catalog
  `<select>`, a name input, start/end (snap on blur), remove. "Add from catalog" appends a snapped span.
- Wire into `/rig-day`: the lanes appear under the activity timeline; people/equipment editors join the
  existing block editors; **Save** persists the extended `RigDay`. The accounting rail is unchanged.

## 3. Files

- Core: `rig-day/lanes.ts` (`LaneItem`, catalogs, finders, `deriveProgress`), extend `rig-day/types.ts`
  (`RigDay.people/equipment`) + `rig-day/seed.ts`; export from `index.ts`; tests (catalogs unique,
  `deriveProgress` ordering, back-compat load of a day without lanes).
- Web: `components/rig-day-lanes.tsx`, `components/lane-editors.tsx`; extend `app/(hub)/rig-day/page.tsx`;
  RTL tests (lanes render a bar per item; progress path present; add-from-catalog appends).

## 4. Definition of done

Open `/rig-day`: under the activity timeline, see **people**, **equipment**, and a **progress** depth
curve aligned to the same clock; **add a person/equipment from its catalog**, set its span, and watch
the lane update — all on the mock adapter, in the Valor brand, on the live link. Same primitive across
lanes; new party/gear types are catalog rows.

## 5. Review

Standard pipeline (gates 1–8) + dual-bot PR review with **max adherence** (action every finding by
default). PR base = `master`.
