# Local Database Workbench — Design Spec

**Status:** draft for b.jones review · **Date:** 2026-06-08 · **Branch:** `feat/local-database`

**Goal:** A human-operated **Local Database** layer over the existing local store — see every collection,
and **save/load the whole local DB as a snapshot file** (export/import) + reset-to-seed. Structured
exactly like the backend environment it mirrors (same collections behind the same `Repository` seam), so
the human is in full control of the data and the local/cloud stores are interchangeable.

**Non-goals (later):** per-record editing here (the registries already edit objects), conflict merge on
import (last-write-wins for now), cloud sync (that's the Supabase scaffold).

---

## 1. Core (`packages/core/src/local-db/`)

```ts
import type { DashboardLayout } from '../widgets/types';
import type { WellSetup } from '../well-setup/types';
import type { RigDay } from '../rig-day/types';
import type { ChannelDef } from '../data-manager/types';
import type { Vendor, AfeLine } from '../office-ops/types';

export interface LocalDbSnapshot {
  version: 1;
  exportedAt?: string;                       // stamped by the caller (no Date in core)
  collections: {
    dashboards?: DashboardLayout[];          // keyed by ownerId (on the object)
    wellSetups?: { wellId: string; setup: WellSetup }[];
    rigDays?: RigDay[];                       // keyed by id (on the object)
    channels?: ChannelDef[];
    vendors?: Vendor[];
    afe?: AfeLine[];
  };
}
export interface CollectionInfo { key: string; label: string; count: number; }
export function isValidSnapshot(v: unknown): v is LocalDbSnapshot;        // version===1 + collections object
export function summarizeSnapshot(s: LocalDbSnapshot): CollectionInfo[];  // label + count per collection
```

Repo seam (`Repository` + `MockRepository`):

```ts
exportSnapshot(): Promise<LocalDbSnapshot>;        // gather all stores
importSnapshot(s: LocalDbSnapshot): Promise<void>; // restore via existing save methods (last-write-wins)
listCollections(): Promise<CollectionInfo[]>;      // = summarizeSnapshot(exportSnapshot())
resetLocalDb(): Promise<void>;                     // clear all valor:* keys / in-memory maps
```

`MockRepository`: browser path enumerates `localStorage` keys with the `valor:` prefix (deriving ids from
`valor:wellsetup:<id>` etc.); node path reads the in-memory `Map`s. `importSnapshot` calls the existing
`saveDashboard`/`saveWellSetup`/`saveRigDay`/`saveChannels`/`saveVendors`/`saveAfe`. `resetLocalDb`
removes the `valor:` keys (browser) or clears the maps (node). All pure-ish, never throws on bad input.

## 2. Web

- **`/local-db` screen** (`'use client'`): `getRepo().listCollections()` on mount + after each action.
  - A **collections table** (`data-testid="collection-row"` each): label · count · a short description.
  - **Export** → `exportSnapshot()` → download `valor-localdb-<stamp>.json` (stamp from the browser, not core).
  - **Import** → file picker → parse + `isValidSnapshot` guard → `importSnapshot` → refresh (last-write-wins; invalid file → inline error).
  - **Reset to seed** → confirm → `resetLocalDb()` → refresh (collections drop to their seed/empty state).
  - `PageHeader` ("Local Database / Save, load, and inspect the local data store"), brand layout, `LoadingState`.
- **Nav:** add a "Local Database" link to `app-shell.tsx` (Database/HardDrive icon).

## 3. Files

- Core: `local-db/types.ts` (snapshot + `isValidSnapshot` + `summarizeSnapshot`); repo seam edits in
  `repository.ts` + `mock-repository.ts`; `index.ts` export; tests (snapshot round-trips through
  export→import; `summarizeSnapshot` counts; `isValidSnapshot` guards; reset empties).
- Web: `components/local-db-workbench.tsx` (the table + actions, controlled by callbacks),
  `lib/export-snapshot.ts` (download/parse helpers), `app/(hub)/local-db/page.tsx`, `app-shell.tsx` nav;
  RTL tests (collections render; export builds a blob; import-invalid shows error).

## 4. Definition of done

Open `/local-db`: see every collection with live counts; **Export** downloads a JSON snapshot of the whole
local DB; **Import** restores one; **Reset to seed** clears it — all human-driven, on the mock adapter, in
the Valor brand, on the live link. The snapshot shape mirrors the Supabase schema (the two stores are
interchangeable behind `Repository`).

## 5. Review

Standard pipeline (gates 1–8) + dual-bot PR review with **max adherence**. PR base = `master`.
