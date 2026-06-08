# Local Database Workbench — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A Local Database screen to save/load the whole local store as a snapshot + browse collections + reset-to-seed.

**Architecture:** `@valor/core` `local-db` snapshot model + `Repository` seam (`exportSnapshot`/`importSnapshot`/`listCollections`/`resetLocalDb`) implemented by `MockRepository`; a web workbench screen. Mirrors the shipped patterns; the snapshot shape mirrors the Supabase schema.

**Spec:** `docs/superpowers/specs/2026-06-08-local-database-design.md`

**Conventions:** extensionless imports; pure fns never throw; **no `Date.now()`/`Math.random()` in core** (caller stamps `exportedAt`); reuse existing `save*` methods; add exports to `index.ts`.

---

## Task 1: Snapshot model (core)

**Files:** Create `packages/core/src/local-db/types.ts`, `packages/core/test/local-db.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { isValidSnapshot, summarizeSnapshot } from '../src/local-db/types';

describe('local-db snapshot', () => {
  it('summarizes counts across collections', () => {
    const info = summarizeSnapshot({ version: 1, collections: { channels: [{} as never, {} as never], vendors: [] } });
    expect(info.find((c) => c.key === 'channels')?.count).toBe(2);
    expect(info.find((c) => c.key === 'vendors')?.count).toBe(0);
    expect(info.find((c) => c.key === 'rigDays')?.count).toBe(0); // absent → 0
  });
  it('validates a snapshot', () => {
    expect(isValidSnapshot({ version: 1, collections: {} })).toBe(true);
    expect(isValidSnapshot({ version: 2, collections: {} })).toBe(false);
    expect(isValidSnapshot({ collections: {} })).toBe(false);
    expect(isValidSnapshot(null)).toBe(false);
  });
});
```

- [ ] **Step 2:** `corepack pnpm --filter @valor/core test local-db` → FAIL.
- [ ] **Step 3: Implement** `types.ts`:

```ts
import type { DashboardLayout } from '../widgets/types';
import type { WellSetup } from '../well-setup/types';
import type { RigDay } from '../rig-day/types';
import type { ChannelDef } from '../data-manager/types';
import type { Vendor, AfeLine } from '../office-ops/types';

export interface LocalDbSnapshot {
  version: 1;
  exportedAt?: string;
  collections: {
    dashboards?: DashboardLayout[];
    wellSetups?: { wellId: string; setup: WellSetup }[];
    rigDays?: RigDay[];
    channels?: ChannelDef[];
    vendors?: Vendor[];
    afe?: AfeLine[];
  };
}
export interface CollectionInfo { key: string; label: string; count: number; }

const COLLECTIONS: { key: keyof LocalDbSnapshot['collections']; label: string }[] = [
  { key: 'dashboards', label: 'Dashboards' },
  { key: 'wellSetups', label: 'Well Setups' },
  { key: 'rigDays', label: 'Rig Days' },
  { key: 'channels', label: 'Channels' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'afe', label: 'AFE Lines' },
];

export function isValidSnapshot(v: unknown): v is LocalDbSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return s.version === 1 && !!s.collections && typeof s.collections === 'object';
}

export function summarizeSnapshot(s: LocalDbSnapshot): CollectionInfo[] {
  return COLLECTIONS.map(({ key, label }) => ({
    key, label, count: Array.isArray(s.collections?.[key]) ? (s.collections[key] as unknown[]).length : 0,
  }));
}
```

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(core): local-db snapshot model + summarize/validate`.

## Task 2: Repository seam (export/import/list/reset)

**Files:** Modify `repository.ts`, `mock-repository.ts`; Create `packages/core/test/mock-repository.local-db.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEFAULT_CHANNELS } from '../src/data-manager/channels';
import { DEFAULT_RIG_DAY } from '../src/rig-day/seed';

describe('MockRepository local-db', () => {
  it('export → reset → import round-trips (in-memory)', async () => {
    const r = new MockRepository();
    await r.saveChannels(DEFAULT_CHANNELS);
    await r.saveRigDay(DEFAULT_RIG_DAY.id, DEFAULT_RIG_DAY);
    const snap = await r.exportSnapshot();
    expect(snap.collections.channels?.length).toBe(DEFAULT_CHANNELS.length);
    expect(snap.collections.rigDays?.length).toBe(1);

    await r.resetLocalDb();
    expect((await r.listCollections()).every((c) => c.count === 0)).toBe(true);

    await r.importSnapshot(snap);
    expect((await r.loadChannels())?.length).toBe(DEFAULT_CHANNELS.length);
    expect((await r.loadRigDay(DEFAULT_RIG_DAY.id))?.blocks.length).toBe(DEFAULT_RIG_DAY.blocks.length);
  });
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — add to `Repository`:

```ts
exportSnapshot(): Promise<import('./local-db/types').LocalDbSnapshot>;
importSnapshot(snapshot: import('./local-db/types').LocalDbSnapshot): Promise<void>;
listCollections(): Promise<import('./local-db/types').CollectionInfo[]>;
resetLocalDb(): Promise<void>;
```

In `MockRepository` (gathers/restores its known stores; browser scans `valor:` keys, node reads maps):

```ts
async exportSnapshot() {
  const store = this.browserStorage;
  const collections: import('./local-db/types').LocalDbSnapshot['collections'] = {
    dashboards: [], wellSetups: [], rigDays: [], channels: [], vendors: [], afe: [],
  };
  if (store) {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i); if (!k || !k.startsWith('valor:')) continue;
      const raw = store.getItem(k); if (!raw) continue;
      try {
        if (k.startsWith('valor:dashboard:')) collections.dashboards!.push(JSON.parse(raw));
        else if (k.startsWith('valor:wellsetup:')) collections.wellSetups!.push({ wellId: k.slice('valor:wellsetup:'.length), setup: JSON.parse(raw) });
        else if (k.startsWith('valor:rigday:')) collections.rigDays!.push(JSON.parse(raw));
        else if (k === 'valor:channels') collections.channels = JSON.parse(raw);
        else if (k === 'valor:vendors') collections.vendors = JSON.parse(raw);
        else if (k === 'valor:afe') collections.afe = JSON.parse(raw);
      } catch { /* skip malformed */ }
    }
  } else {
    collections.dashboards = [...this.dashboards.values()].map((d) => structuredClone(d));
    collections.wellSetups = [...this.wellSetups.entries()].map(([wellId, setup]) => ({ wellId, setup: structuredClone(setup) }));
    collections.rigDays = [...this.rigDays.values()].map((d) => structuredClone(d));
    collections.channels = this.channels ? structuredClone(this.channels) : [];
    collections.vendors = this.vendors ? structuredClone(this.vendors) : [];
    collections.afe = this.afe ? structuredClone(this.afe) : [];
  }
  return { version: 1 as const, collections };
}

async importSnapshot(snapshot: import('./local-db/types').LocalDbSnapshot) {
  const c = snapshot?.collections ?? {};
  for (const d of c.dashboards ?? []) await this.saveDashboard(d);
  for (const w of c.wellSetups ?? []) await this.saveWellSetup(w.wellId, w.setup);
  for (const r of c.rigDays ?? []) await this.saveRigDay(r.id, r);
  if (c.channels) await this.saveChannels(c.channels);
  if (c.vendors) await this.saveVendors(c.vendors);
  if (c.afe) await this.saveAfe(c.afe);
}

async listCollections() {
  const { summarizeSnapshot } = await import('./local-db/types');
  return summarizeSnapshot(await this.exportSnapshot());
}

async resetLocalDb() {
  const store = this.browserStorage;
  if (store) {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.startsWith('valor:')) keys.push(k); }
    keys.forEach((k) => store.removeItem(k));
  } else {
    this.dashboards.clear(); this.wellSetups.clear(); this.rigDays.clear();
    this.channels = null; this.vendors = null; this.afe = null;
  }
}
```

(Use a top-of-file `import { summarizeSnapshot } from './local-db/types';` instead of the dynamic import if cleaner — match existing style; the dynamic import avoids a type-only cycle but a normal import is fine since `local-db/types` only type-imports.)

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(core): repository seam for local-db snapshot/reset`.

## Task 3: Export

**Files:** Modify `packages/core/src/index.ts`

- [ ] Add `export * from './local-db/types';`. Full core `test` + `typecheck` green. Commit `feat(core): export local-db`.

## Task 4: `<LocalDbWorkbench>` + export/import helpers

**Files:** Create `apps/web/components/local-db-workbench.tsx`, `apps/web/lib/export-snapshot.ts`, `apps/web/__tests__/local-db-workbench.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { LocalDbWorkbench } from '@/components/local-db-workbench';

const collections = [
  { key: 'channels', label: 'Channels', count: 16 },
  { key: 'vendors', label: 'Vendors', count: 6 },
];

it('renders a row per collection and fires export', () => {
  const onExport = vi.fn(); const onImport = vi.fn(); const onReset = vi.fn();
  const { getAllByTestId, getByRole } = render(
    <LocalDbWorkbench collections={collections} onExport={onExport} onImport={onImport} onReset={onReset} />,
  );
  expect(getAllByTestId('collection-row').length).toBe(2);
  fireEvent.click(getByRole('button', { name: /export/i }));
  expect(onExport).toHaveBeenCalled();
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement**
  - `lib/export-snapshot.ts`: `downloadSnapshot(snapshot, filename)` (serialize → Blob → anchor download; `URL.createObjectURL`/`revokeObjectURL`), and `readSnapshotFile(file): Promise<unknown>` (FileReader → `JSON.parse`).
  - `components/local-db-workbench.tsx`: `LocalDbWorkbench({ collections, onExport, onImport, onReset })` — a collections table (`data-testid="collection-row"`: label · count · description from a small map), an **Export** button (`onExport`), an **Import** `<input type=file>` + button (`onImport(file)`), a **Reset to seed** button (`onReset`). Reuse Card + brand styling.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): local-db workbench + snapshot export/import helpers`.

## Task 5: `/local-db` page + nav

**Files:** Create `apps/web/app/(hub)/local-db/page.tsx`; modify `apps/web/components/app-shell.tsx`

- [ ] **Step 1: Implement** — `'use client'`: `getRepo().listCollections()` on mount + after actions; `LoadingState` while loading; `PageHeader` ("Local Database"); `<LocalDbWorkbench>` wired:
  - `onExport` → `getRepo().exportSnapshot()` → stamp `exportedAt = new Date().toISOString()` (browser, allowed) → `downloadSnapshot(snap, \`valor-localdb-${Date.now()}.json\`)`.
  - `onImport(file)` → `readSnapshotFile(file)` → `isValidSnapshot` guard (else inline error) → `getRepo().importSnapshot(snap)` → refresh.
  - `onReset` → confirm → `getRepo().resetLocalDb()` → refresh.
  - Add a "Local Database" nav link (Database/HardDrive icon) to `app-shell.tsx`.

- [ ] **Step 2:** `corepack pnpm --filter @valor/web build` compiles `/local-db`; `typecheck` 0. **Step 3:** Commit `feat(web): local-db page + nav`.

## Task 6: Integrate, verify, ship

- [ ] core `test`+`typecheck`, web `test`+`typecheck`+`build` all green.
- [ ] Restart server; capture `/local-db`; send for punchlist.
- [ ] Push `feat/local-database`; open PR (base `master`); action bots per max-adherence; merge on clean review.

## Self-Review
- **Spec coverage:** snapshot model (§1 ✓ T1), repo seam (§1 ✓ T2), workbench+helpers (§2 ✓ T4), page+nav (§2 ✓ T5), DoD (§4 ✓ T6).
- **Type consistency:** `LocalDbSnapshot`/`CollectionInfo`/`isValidSnapshot`/`summarizeSnapshot`/`exportSnapshot`/`importSnapshot`/`listCollections`/`resetLocalDb`/`downloadSnapshot`/`readSnapshotFile` consistent.
- **No placeholders:** core steps carry full code; web steps carry signatures, `data-testid` contracts, and tests.
