# Valor Operations Hub — Plan 2: Asset Hierarchy Module

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the asset-hierarchy module — a data-driven sidebar tree, an Assets (fields) overview, and a Well detail view (header + formations + casing program) — styled with shadcn/ui primitives, all reading the VEP seed through the existing `Repository` interface.

**Architecture:** Extend `@valor/core` with read-only hierarchy queries + view-model composite types (still behind the `Repository` interface, still served by `MockRepository`). Add shadcn/ui primitives to `apps/web` and build the hierarchy screens as server components that fetch via `getRepo()`. No backend, no mutations — read-only views over seeded data.

**Tech Stack:** Next.js 15 (App Router) + React 19, Tailwind 3.4, shadcn/ui (class-variance-authority + clsx + tailwind-merge), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-07-valor-operations-hub-design.md`
**Review/merge process:** `docs/superpowers/process/review-pipeline.md`

## Prerequisites & branch

- Plan 1 must be merged to `master` first (PR #1). Branch this work from `master`:
  `git checkout master && git pull && git checkout -b feat/asset-hierarchy`
  (If Plan 1 is not yet merged, branch from `feat/foundation-core` instead so Plan 1's code is present.)
- Confirm baseline is green before starting: `corepack pnpm install && corepack pnpm --filter @valor/core test`.

---

## File Structure

```
packages/core/
  src/
    views.ts              # NEW: AssetTreeNode, AssetTreePad, WellboreDetail, WellDetail view-models
    repository.ts         # MODIFY: add listAssets / getAssetTree / getWellDetail to Repository
    mock-repository.ts    # MODIFY: implement the three hierarchy reads
    seed.ts               # MODIFY: add a second well (well-lf2) for a meaningful tree
    index.ts              # MODIFY: export views
  test/
    hierarchy.test.ts     # NEW: tests for the hierarchy reads

apps/web/
  components.json         # NEW: shadcn config (for future `shadcn add`)
  lib/utils.ts            # NEW: cn() helper
  app/globals.css         # MODIFY: shadcn CSS variable theme
  tailwind.config.ts      # MODIFY: map theme colors to CSS vars
  components/ui/
    card.tsx              # NEW
    badge.tsx             # NEW
    table.tsx             # NEW
    separator.tsx         # NEW
  components/
    asset-tree.tsx        # NEW: data-driven sidebar tree
    app-shell.tsx         # MODIFY: accept `tree` prop + add Assets nav
    formations-table.tsx  # NEW
    casing-table.tsx      # NEW
    well-header.tsx       # NEW
  app/(hub)/
    layout.tsx            # MODIFY: fetch the asset tree, pass to AppShell
    assets/page.tsx       # NEW: fields overview
    wells/[wellId]/page.tsx # NEW: well detail
```

**Responsibilities:** view-model composites live in `views.ts` (kept separate from raw entity `types.ts`); each table/card is its own focused presentational component; `lib/repo.ts` remains the only data entry point.

---

## Task 1: Add shadcn/ui foundation (deps, cn, theme, primitives)

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/lib/utils.ts`
- Create: `apps/web/components.json`
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/components/ui/card.tsx`, `badge.tsx`, `table.tsx`, `separator.tsx`

- [ ] **Step 1: Add the runtime dependencies**

Run (from repo root):
```bash
corepack pnpm --filter @valor/web add clsx tailwind-merge class-variance-authority
```
Expected: adds the three packages to `apps/web/package.json` dependencies and updates the lockfile.

- [ ] **Step 2: Create the `cn` helper**

Create `apps/web/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create the shadcn config (for future `shadcn add`)**

Create `apps/web/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

- [ ] **Step 4: Map theme colors to CSS variables in Tailwind**

Replace `apps/web/tailwind.config.ts` with:
```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 5: Add the CSS variable theme to globals**

Replace `apps/web/app/globals.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 210 40% 98%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --primary: 222 47% 11%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222 47% 11%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 222 47% 11%;
    --radius: 0.5rem;
  }
  * {
    border-color: hsl(var(--border));
  }
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
  }
}
```

- [ ] **Step 6: Create the Card primitive**

Create `apps/web/components/ui/card.tsx`:
```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)} {...props} />;
}
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}
function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('font-semibold leading-none tracking-tight', className)} {...props} />;
}
function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}
export { Card, CardHeader, CardTitle, CardDescription, CardContent };
```

- [ ] **Step 7: Create the Badge primitive**

Create `apps/web/components/ui/badge.tsx`:
```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
```

- [ ] **Step 8: Create the Table primitives**

Create `apps/web/components/ui/table.tsx`:
```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}
function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}
function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return <tr className={cn('border-b transition-colors hover:bg-muted/50', className)} {...props} />;
}
function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return <th className={cn('h-10 px-2 text-left align-middle font-medium text-muted-foreground', className)} {...props} />;
}
function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('p-2 align-middle', className)} {...props} />;
}
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
```

- [ ] **Step 9: Create the Separator primitive**

Create `apps/web/components/ui/separator.tsx`:
```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

function Separator({ className, ...props }: React.ComponentProps<'div'>) {
  return <div role="separator" className={cn('h-px w-full shrink-0 bg-border', className)} {...props} />;
}
export { Separator };
```

- [ ] **Step 10: Verify the app still builds with the new theme**

Run:
```bash
corepack pnpm --filter @valor/web build
```
Expected: build succeeds (the jobs board still renders; theme classes resolve).

- [ ] **Step 11: Commit**

```bash
git add apps/web/package.json apps/web/lib/utils.ts apps/web/components.json apps/web/tailwind.config.ts apps/web/app/globals.css apps/web/components/ui pnpm-lock.yaml
git commit -m "feat(web): add shadcn/ui foundation (cn, theme, card/badge/table/separator)"
```

---

## Task 2: Core hierarchy reads + view-models (TDD)

**Files:**
- Create: `packages/core/src/views.ts`
- Modify: `packages/core/src/repository.ts`
- Modify: `packages/core/src/seed.ts`
- Modify: `packages/core/src/mock-repository.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/hierarchy.test.ts`

- [ ] **Step 1: Define the view-model composite types**

Create `packages/core/src/views.ts`:
```ts
import type { Asset, CasingString, Formation, Pad, Well, Wellbore } from './types';

export interface AssetTreePad {
  pad: Pad;
  wells: Well[];
}

export interface AssetTreeNode {
  asset: Asset;
  pads: AssetTreePad[];
}

export interface WellboreDetail extends Wellbore {
  formations: Formation[];
  casingStrings: CasingString[];
}

export interface WellDetail {
  well: Well;
  wellbores: WellboreDetail[];
}
```

- [ ] **Step 2: Add the hierarchy methods to the Repository interface**

In `packages/core/src/repository.ts`, add the import and three methods. The import line at the top becomes:
```ts
import type { Asset, Job, JobTemplate, JobWithRelations, TemplateFieldDef, TemplateStageDef, Well } from './types';
import type { AssetTreeNode, WellDetail } from './views';
```
And add these three methods to the `Repository` interface (place them after `getWell`):
```ts
  listAssets(orgId: string): Promise<Asset[]>;
  getAssetTree(orgId: string): Promise<AssetTreeNode[]>;
  getWellDetail(wellId: string): Promise<WellDetail | null>;
```

- [ ] **Step 3: Add a second seeded well for a meaningful tree**

In `packages/core/src/seed.ts`, add a second well to the `wells` array (after `well-lf1`):
```ts
    {
      id: 'well-lf2', orgId: org, padId: 'pad-1', name: 'Lease Free #2',
      apiNumber: '34-141-2-0061-00-00', permitNumber: 'PR2026032400123',
      state: 'Ohio', county: 'Ross', township: 'Buckskin', section: 'VMS 2309',
      surfaceLat: 39.3668, surfaceLong: -83.2629, status: 'permitted',
    },
```
(Leave `wellbores`, `formations`, `casingStrings` as-is — `well-lf2` has no wellbore yet, which exercises the empty-state path.)

- [ ] **Step 4: Write the failing test**

Create `packages/core/test/hierarchy.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEMO_ORG_ID } from '../src/seed';

function repo() {
  return new MockRepository();
}

describe('hierarchy reads', () => {
  it('listAssets returns the seeded field', async () => {
    const assets = await repo().listAssets(DEMO_ORG_ID);
    expect(assets).toHaveLength(1);
    expect(assets[0]?.name).toBe('Ross County Field');
  });

  it('getAssetTree nests field -> pad -> wells', async () => {
    const tree = await repo().getAssetTree(DEMO_ORG_ID);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.asset.name).toBe('Ross County Field');
    expect(tree[0]?.pads).toHaveLength(1);
    expect(tree[0]?.pads[0]?.wells.map((w) => w.name)).toEqual(['Lease Free #1', 'Lease Free #2']);
  });

  it('getWellDetail returns wellbores with sorted formations and casing', async () => {
    const detail = await repo().getWellDetail('well-lf1');
    expect(detail?.well.apiNumber).toBe('34-141-2-0059-00-00');
    expect(detail?.wellbores).toHaveLength(1);
    const wb = detail!.wellbores[0]!;
    expect(wb.formations.map((f) => f.name)).toEqual([
      'Ohio Shale', 'Packer Shell', 'Trenton Limestone', 'Black River Group',
    ]);
    expect(wb.casingStrings.map((c) => c.stringType)).toEqual(['conductor', 'surface', 'production']);
  });

  it('getWellDetail returns a well with no wellbores (empty state)', async () => {
    const detail = await repo().getWellDetail('well-lf2');
    expect(detail?.well.name).toBe('Lease Free #2');
    expect(detail?.wellbores).toEqual([]);
  });

  it('getWellDetail returns null for an unknown well', async () => {
    expect(await repo().getWellDetail('nope')).toBeNull();
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run:
```bash
corepack pnpm --filter @valor/core test hierarchy
```
Expected: FAIL — `listAssets`/`getAssetTree`/`getWellDetail` are not implemented on `MockRepository`.

- [ ] **Step 6: Implement the methods on MockRepository**

In `packages/core/src/mock-repository.ts`:

First extend the imports near the top:
```ts
import type { Asset, Job, JobStatusHistory, JobWithRelations, Stage, Well, JobTemplate } from './types';
import type { AssetTreeNode, WellDetail } from './views';
```

Then add these three methods to the `MockRepository` class (place them right after `getWell`):
```ts
  async listAssets(orgId: string): Promise<Asset[]> {
    return this.data.assets.filter((a) => a.orgId === orgId);
  }

  async getAssetTree(orgId: string): Promise<AssetTreeNode[]> {
    return this.data.assets
      .filter((a) => a.orgId === orgId)
      .map((asset) => ({
        asset,
        pads: this.data.pads
          .filter((p) => p.assetId === asset.id)
          .map((pad) => ({
            pad,
            wells: this.data.wells.filter((w) => w.padId === pad.id),
          })),
      }));
  }

  async getWellDetail(wellId: string): Promise<WellDetail | null> {
    const well = this.data.wells.find((w) => w.id === wellId);
    if (!well) return null;
    const wellbores = this.data.wellbores
      .filter((wb) => wb.wellId === wellId)
      .map((wb) => ({
        ...wb,
        formations: this.data.formations
          .filter((f) => f.wellboreId === wb.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
        casingStrings: this.data.casingStrings
          .filter((c) => c.wellboreId === wb.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }));
    return { well, wellbores };
  }
```

- [ ] **Step 7: Export the view-models from the barrel**

In `packages/core/src/index.ts`, add after the `export * from './types';` line:
```ts
export * from './views';
```

- [ ] **Step 8: Run the test to verify it passes (and the full suite)**

Run:
```bash
corepack pnpm --filter @valor/core test hierarchy
corepack pnpm --filter @valor/core test
corepack pnpm --filter @valor/core exec tsc --noEmit
```
Expected: hierarchy 5 passing; full suite green (30 tests total now); tsc exit 0.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/views.ts packages/core/src/repository.ts packages/core/src/seed.ts packages/core/src/mock-repository.ts packages/core/src/index.ts packages/core/test/hierarchy.test.ts
git commit -m "feat(core): asset-tree and well-detail hierarchy reads + view-models"
```

---

## Task 3: Data-driven sidebar asset tree

**Files:**
- Create: `apps/web/components/asset-tree.tsx`
- Modify: `apps/web/components/app-shell.tsx`
- Modify: `apps/web/app/(hub)/layout.tsx`

- [ ] **Step 1: Create the AssetTree component**

Create `apps/web/components/asset-tree.tsx`:
```tsx
import Link from 'next/link';
import type { AssetTreeNode } from '@valor/core';

export function AssetTree({ tree }: { tree: AssetTreeNode[] }) {
  if (tree.length === 0) {
    return <div className="mt-2 text-sm text-slate-400">No assets yet</div>;
  }
  return (
    <div className="mt-2 space-y-3 text-sm">
      {tree.map((node) => (
        <div key={node.asset.id}>
          <div className="font-medium text-slate-200">{node.asset.name}</div>
          {node.pads.map((p) => (
            <div key={p.pad.id} className="ml-2 mt-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">{p.pad.name}</div>
              <ul className="ml-1 mt-0.5">
                {p.wells.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={`/wells/${w.id}`}
                      className="block rounded px-2 py-1 text-slate-300 hover:bg-slate-700"
                    >
                      {w.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update AppShell to render the tree + an Assets nav item**

Replace `apps/web/components/app-shell.tsx` with:
```tsx
import Link from 'next/link';
import type { AssetTreeNode } from '@valor/core';
import { AssetTree } from '@/components/asset-tree';

const NAV = [
  { href: '/jobs', label: 'Active Jobs' },
  { href: '/assets', label: 'Assets' },
];

export function AppShell({ tree, children }: { tree: AssetTreeNode[]; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-slate-900 p-4 text-slate-100">
        <div className="mb-6 text-lg font-semibold">Valor Ops</div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded px-3 py-2 text-sm hover:bg-slate-700"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 text-xs uppercase tracking-wide text-slate-400">Assets</div>
        <AssetTree tree={tree} />
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Fetch the tree in the hub layout and pass it down**

Replace `apps/web/app/(hub)/layout.tsx` with:
```tsx
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { AppShell } from '@/components/app-shell';

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const tree = await getRepo().getAssetTree(DEMO_ORG_ID);
  return <AppShell tree={tree}>{children}</AppShell>;
}
```

- [ ] **Step 4: Verify build + runtime tree render**

Run:
```bash
corepack pnpm --filter @valor/web build
(corepack pnpm --filter @valor/web start -- -p 3100 &) ; sleep 6
curl -s http://localhost:3100/jobs | grep -o "Lease Free #2"
# stop the server you started (kill the node process on port 3100)
```
Expected: build succeeds; the curl finds "Lease Free #2" (the sidebar tree now renders both wells on every hub page). Remember to kill the dev/start server afterward.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/asset-tree.tsx apps/web/components/app-shell.tsx "apps/web/app/(hub)/layout.tsx"
git commit -m "feat(web): data-driven sidebar asset tree"
```

---

## Task 4: Assets (fields) overview page

**Files:**
- Create: `apps/web/app/(hub)/assets/page.tsx`

- [ ] **Step 1: Create the Assets page**

Create `apps/web/app/(hub)/assets/page.tsx`:
```tsx
import Link from 'next/link';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default async function AssetsPage() {
  const tree = await getRepo().getAssetTree(DEMO_ORG_ID);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Assets</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tree.map((node) => {
          const padCount = node.pads.length;
          const wellCount = node.pads.reduce((n, p) => n + p.wells.length, 0);
          return (
            <Card key={node.asset.id}>
              <CardHeader>
                <CardTitle>{node.asset.name}</CardTitle>
                <CardDescription>
                  {node.asset.region ?? 'No region'} · {padCount} pad{padCount === 1 ? '' : 's'} ·{' '}
                  {wellCount} well{wellCount === 1 ? '' : 's'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {node.pads.map((p) => (
                  <div key={p.pad.id}>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {p.pad.name}
                    </div>
                    <ul className="mt-1 space-y-1">
                      {p.wells.map((w) => (
                        <li key={w.id}>
                          <Link href={`/wells/${w.id}`} className="text-sm text-primary hover:underline">
                            {w.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + render**

Run:
```bash
corepack pnpm --filter @valor/web build
(corepack pnpm --filter @valor/web start -- -p 3100 &) ; sleep 6
curl -s http://localhost:3100/assets | grep -o "Ross County Field"
# kill the server on port 3100
```
Expected: build compiles `/assets`; curl finds "Ross County Field".

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(hub)/assets/page.tsx"
git commit -m "feat(web): assets (fields) overview page"
```

---

## Task 5: Well detail page (header + formations + casing)

**Files:**
- Create: `apps/web/components/well-header.tsx`
- Create: `apps/web/components/formations-table.tsx`
- Create: `apps/web/components/casing-table.tsx`
- Create: `apps/web/app/(hub)/wells/[wellId]/page.tsx`

- [ ] **Step 1: Create the WellHeader component**

Create `apps/web/components/well-header.tsx`:
```tsx
import type { Well } from '@valor/core';
import { Badge } from '@/components/ui/badge';

function Field({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? '—'}</div>
    </div>
  );
}

export function WellHeader({ well }: { well: Well }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-semibold">{well.name}</h1>
        {well.status && <Badge variant="secondary">{well.status}</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="API #" value={well.apiNumber} />
        <Field label="Permit #" value={well.permitNumber} />
        <Field label="County / State" value={[well.county, well.state].filter(Boolean).join(', ')} />
        <Field label="Township / Section" value={[well.township, well.section].filter(Boolean).join(' / ')} />
        <Field label="Ground Elev (ft)" value={well.groundElevFt} />
        <Field label="KB Height (ft)" value={well.kbHeightFt} />
        <Field label="Surface Lat" value={well.surfaceLat} />
        <Field label="Surface Long" value={well.surfaceLong} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the FormationsTable component**

Create `apps/web/components/formations-table.tsx`:
```tsx
import type { Formation } from '@valor/core';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function FormationsTable({ formations }: { formations: Formation[] }) {
  if (formations.length === 0) return <p className="text-sm text-muted-foreground">No formations recorded.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Formation</TableHead>
          <TableHead>Top (MD ft)</TableHead>
          <TableHead>Bottom (MD ft)</TableHead>
          <TableHead>Target</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {formations.map((f) => (
          <TableRow key={f.id}>
            <TableCell className="font-medium">{f.name}</TableCell>
            <TableCell>{f.topMdFt ?? '—'}</TableCell>
            <TableCell>{f.bottomMdFt ?? '—'}</TableCell>
            <TableCell>{f.targetZone ? <Badge>Target</Badge> : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create the CasingTable component**

Create `apps/web/components/casing-table.tsx`:
```tsx
import type { CasingString } from '@valor/core';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CasingTable({ casing }: { casing: CasingString[] }) {
  if (casing.length === 0) return <p className="text-sm text-muted-foreground">No casing program recorded.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>String</TableHead>
          <TableHead>Hole (in)</TableHead>
          <TableHead>Set (MD ft)</TableHead>
          <TableHead>OD (in)</TableHead>
          <TableHead>Wt (#/ft)</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>Cement (sx)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {casing.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium capitalize">{c.stringType}</TableCell>
            <TableCell>{c.holeDiaIn ?? '—'}</TableCell>
            <TableCell>{c.setMdFt ?? '—'}</TableCell>
            <TableCell>{c.csgOdIn ?? '—'}</TableCell>
            <TableCell>{c.weightPpf ?? '—'}</TableCell>
            <TableCell>{c.grade ?? '—'}</TableCell>
            <TableCell>{c.cementSacks ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Create the Well detail page**

Note: in Next.js 15, dynamic-route `params` is a Promise and MUST be awaited.

Create `apps/web/app/(hub)/wells/[wellId]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import { WellHeader } from '@/components/well-header';
import { FormationsTable } from '@/components/formations-table';
import { CasingTable } from '@/components/casing-table';
import { Separator } from '@/components/ui/separator';

export default async function WellPage({ params }: { params: Promise<{ wellId: string }> }) {
  const { wellId } = await params;
  const detail = await getRepo().getWellDetail(wellId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/assets" className="hover:underline">Assets</Link> / {detail.well.name}
      </nav>

      <WellHeader well={detail.well} />

      {detail.wellbores.length === 0 && (
        <p className="text-sm text-muted-foreground">No wellbores recorded for this well yet.</p>
      )}

      {detail.wellbores.map((wb) => (
        <section key={wb.id} className="space-y-4 rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{wb.designation}</h2>
            <span className="text-sm text-muted-foreground capitalize">{wb.type}</span>
            {wb.totalMdFt != null && (
              <span className="text-sm text-muted-foreground">· TD {wb.totalMdFt} ft MD</span>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Formations</h3>
            <FormationsTable formations={wb.formations} />
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-sm font-medium">Casing program</h3>
            <CasingTable casing={wb.casingStrings} />
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify build + render (real data, formations + casing)**

Run:
```bash
corepack pnpm --filter @valor/web exec tsc --noEmit
corepack pnpm --filter @valor/web build
(corepack pnpm --filter @valor/web start -- -p 3100 &) ; sleep 6
curl -s http://localhost:3100/wells/well-lf1 | grep -o "Trenton Limestone"
curl -s http://localhost:3100/wells/well-lf1 | grep -o "conductor"
curl -s "http://localhost:3100/wells/well-lf2" | grep -o "No wellbores recorded"
# kill the server on port 3100
```
Expected: tsc clean; build compiles `/wells/[wellId]`; curl finds "Trenton Limestone" and "conductor" on well-lf1, and the empty-state on well-lf2.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/well-header.tsx apps/web/components/formations-table.tsx apps/web/components/casing-table.tsx "apps/web/app/(hub)/wells/[wellId]/page.tsx"
git commit -m "feat(web): well detail page (header, formations, casing program)"
```

---

## Task 6: Visual polish pass + full verification

**Files:**
- Modify (polish only): `apps/web/components/*.tsx`, `apps/web/app/(hub)/**/page.tsx` as needed

- [ ] **Step 1: Apply the frontend-design skill for polish**

Invoke the `frontend-design` skill and apply it to the hierarchy screens (Assets overview, Well detail, sidebar tree) and revisit the jobs board for consistency. Goals: clear visual hierarchy and typography, comfortable spacing, readable data-dense tables (zebra/hover, aligned numerics), consistent card styling, and an overall look that is polished and distinctive rather than generic. Keep all behavior and data flow unchanged — this is presentation only. Do not introduce new data dependencies or libraries beyond small, well-justified additions (e.g., `lucide-react` for icons is acceptable if added via `corepack pnpm --filter @valor/web add lucide-react`).

- [ ] **Step 2: Full verification after polish**

Run:
```bash
corepack pnpm --filter @valor/core test
corepack pnpm --filter @valor/web exec tsc --noEmit
corepack pnpm --filter @valor/web build
```
Expected: core tests green (30); tsc clean; build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "style(web): polish asset-hierarchy screens (frontend-design pass)"
```

---

## Task 7: Finish — review pipeline & merge

Follow `docs/superpowers/process/review-pipeline.md`.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/asset-hierarchy
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --base master --head feat/asset-hierarchy \
  --title "Plan 2: Asset hierarchy module (tree, fields, well detail) + shadcn/ui" \
  --body "Implements Plan 2 (docs/superpowers/plans/2026-06-07-valor-ops-asset-hierarchy.md): hierarchy reads in @valor/core, data-driven sidebar tree, /assets overview, and /wells/[wellId] detail with formations + casing, styled with shadcn/ui. Read-only over the VEP seed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Triage CodeRabbit**

Wait for CodeRabbit's automatic review, then fetch and triage findings per the merge checklist:
```bash
gh pr view <PR#> --repo BravoWon/ValorOperations_SB --json comments \
  --jq '.comments[] | select(.author.login=="coderabbitai") | .body'
```
Fix Critical/Important findings on the branch; justify or resolve the rest. Do not merge with un-triaged findings.

- [ ] **Step 4: Human review + merge** per the merge checklist.

---

## Definition of Done (Plan 2)

- `corepack pnpm --filter @valor/core test` green (30 tests incl. 5 hierarchy tests).
- `corepack pnpm --filter @valor/web build` succeeds; `/assets` and `/wells/[wellId]` compile.
- Sidebar shows the data-driven asset tree on every hub page; clicking a well opens its detail.
- Well detail renders the VEP formations + casing program from the seed; `well-lf2` shows the empty state.
- All UI still reads only via `@valor/core` + `@/lib/repo` (the adapter seam is intact).
- CodeRabbit findings triaged; PR merged.

## Next plan
- **Plan 3** — Templates editor, job create-from-template wizard (with Zod + forms/server-actions), and the tabbed job detail (stages, inputs via `field_values`, events/NPT, attachments).
