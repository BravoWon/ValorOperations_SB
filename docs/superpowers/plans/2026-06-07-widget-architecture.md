# Widget Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A developer-extensible widget **registry** feeding a user-composable **dashboard** (drag + resize grid), with dashboard layout persisted through the `Repository` seam (localStorage-backed mock), and the existing screens migrated into widgets.

**Architecture:** Widget descriptor + dashboard types live in `@valor/core`; a web-side registry maps `id → { def, Component }`. The dashboard (`react-grid-layout`) renders widget instances, each wrapped in `WidgetCard` chrome. Widgets fetch their own data client-side via `getRepo()` (mock adapter runs client-side). Layout persists via `Repository.getDashboard/saveDashboard` (localStorage in the browser). All UI in the Valor dark/gold/glass theme.

**Tech Stack:** TypeScript, Vitest (+ RTL/jsdom in `apps/web`), Next.js 15 + React 19, `react-grid-layout@^2.2.3`, lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-07-widget-architecture-design.md`
**Branch:** `feat/widget-architecture` (from `master`).

---

## File Structure
```
packages/core/src/widgets/types.ts     # NEW: WidgetCategory, WidgetDefinition, WidgetInstance, DashboardLayout, createDefaultDashboard()
packages/core/src/repository.ts        # MODIFY: + getDashboard / saveDashboard
packages/core/src/mock-repository.ts   # MODIFY: implement them (localStorage-backed + in-memory fallback)
packages/core/src/index.ts             # MODIFY: export widgets/types
packages/core/test/dashboard.test.ts   # NEW
apps/web/lib/widgets/registry.ts       # NEW: registerWidget/getWidget/listWidgets (+ clearRegistry for tests)
apps/web/lib/use-repo-data.ts          # NEW: client data hook
apps/web/components/widgets/widget-card.tsx     # NEW: chrome
apps/web/components/widgets/widget-catalog.tsx  # NEW: add-widget picker
apps/web/components/widgets/dashboard.tsx       # NEW: react-grid-layout host (client)
apps/web/widgets/                      # NEW: one self-registering module per widget
  kpi-strip.widget.tsx, active-jobs.widget.tsx, asset-tree.widget.tsx,
  hydraulics.widget.tsx, daily-report.stub.tsx, power-bi.stub.tsx, index.ts
apps/web/app/(hub)/dashboard/page.tsx  # NEW: renders <Dashboard/>
apps/web/app/page.tsx                  # MODIFY: redirect '/' -> '/dashboard'
apps/web/components/app-shell.tsx      # MODIFY: add Dashboard nav item
apps/web/vitest.setup.ts               # MODIFY: ResizeObserver + matchMedia polyfills
apps/web/__tests__/                    # NEW: registry/widget-card/widget-catalog/dashboard tests
```

---

## Task 1: Core widget + dashboard types (TDD)

**Files:** Create `packages/core/src/widgets/types.ts`; Modify `packages/core/src/index.ts`; Test `packages/core/test/dashboard.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/dashboard.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createDefaultDashboard } from '../src/widgets/types';

describe('createDefaultDashboard', () => {
  it('builds a default dashboard for an owner with the four core widgets', () => {
    const d = createDefaultDashboard('user-1');
    expect(d.ownerId).toBe('user-1');
    expect(d.widgets.map((w) => w.widgetId)).toEqual([
      'kpi-strip', 'active-jobs', 'asset-tree', 'hydraulics',
    ]);
  });

  it('gives every widget a unique instanceId and a layout', () => {
    const d = createDefaultDashboard('user-1');
    const ids = d.widgets.map((w) => w.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of d.widgets) {
      expect(w.layout).toMatchObject({
        x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number),
      });
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `corepack pnpm --filter @valor/core test dashboard`
Expected: FAIL — cannot resolve `../src/widgets/types`.

- [ ] **Step 3: Implement**

Create `packages/core/src/widgets/types.ts`:
```ts
export type WidgetCategory = 'compute' | 'data' | 'report' | 'embed';

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
}

export interface WidgetInstance {
  instanceId: string;
  widgetId: string;
  layout: { x: number; y: number; w: number; h: number };
  config?: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  ownerId: string;
  widgets: WidgetInstance[];
}

/** Deterministic first-run layout (12-col grid). instanceIds are fixed for the defaults. */
export function createDefaultDashboard(ownerId: string): DashboardLayout {
  return {
    id: 'default',
    ownerId,
    widgets: [
      { instanceId: 'w-kpi', widgetId: 'kpi-strip', layout: { x: 0, y: 0, w: 12, h: 2 } },
      { instanceId: 'w-jobs', widgetId: 'active-jobs', layout: { x: 0, y: 2, w: 8, h: 8 } },
      { instanceId: 'w-asset', widgetId: 'asset-tree', layout: { x: 8, y: 2, w: 4, h: 8 } },
      { instanceId: 'w-hydraulics', widgetId: 'hydraulics', layout: { x: 0, y: 10, w: 8, h: 12 } },
    ],
  };
}
```

- [ ] **Step 4: Export from barrel**

In `packages/core/src/index.ts`, add after the existing exports:
```ts
export * from './widgets/types';
```

- [ ] **Step 5: Run to verify it passes**

Run: `corepack pnpm --filter @valor/core test dashboard` → 2 passing. Then `corepack pnpm --filter @valor/core exec tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**
```bash
git add packages/core/src/widgets/types.ts packages/core/src/index.ts packages/core/test/dashboard.test.ts
git commit -m "feat(core): widget + dashboard types and default layout"
```

---

## Task 2: Dashboard persistence on the repository (TDD)

**Files:** Modify `packages/core/src/repository.ts`, `packages/core/src/mock-repository.ts`; Test extends `packages/core/test/dashboard.test.ts`.

- [ ] **Step 1: Write the failing test (append to `dashboard.test.ts`)**
```ts
import { MockRepository } from '../src/mock-repository';

function fakeLocalStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe('dashboard persistence', () => {
  it('returns the default dashboard when none is stored', async () => {
    const d = await new MockRepository().getDashboard('user-1');
    expect(d.widgets).toHaveLength(4);
  });

  it('round-trips a saved dashboard (in-memory fallback)', async () => {
    const repo = new MockRepository();
    const layout = { id: 'd', ownerId: 'user-1', widgets: [] };
    await repo.saveDashboard(layout);
    expect((await repo.getDashboard('user-1')).widgets).toEqual([]);
  });

  it('persists via localStorage when present', async () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = fakeLocalStorage();
    try {
      const repo = new MockRepository();
      await repo.saveDashboard({ id: 'd', ownerId: 'u2', widgets: [] });
      const raw = globalThis.localStorage.getItem('valor:dashboard:u2');
      expect(raw).toContain('"ownerId":"u2"');
      expect((await new MockRepository().getDashboard('u2')).widgets).toEqual([]);
    } finally {
      delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `corepack pnpm --filter @valor/core test dashboard`
Expected: FAIL — `getDashboard`/`saveDashboard` not on `MockRepository`.

- [ ] **Step 3: Add to the `Repository` interface**

In `packages/core/src/repository.ts`: add the import and two methods.
Add to the imports: `import type { DashboardLayout } from './widgets/types';`
Add to the `Repository` interface (after `getWellDetail`):
```ts
  getDashboard(ownerId: string): Promise<DashboardLayout>;
  saveDashboard(layout: DashboardLayout): Promise<void>;
```

- [ ] **Step 4: Implement on `MockRepository`**

In `packages/core/src/mock-repository.ts`: extend the views import and add the methods.
Extend the import: `import type { AssetTreeNode, WellDetail } from './views';` stays; add
`import { createDefaultDashboard, type DashboardLayout } from './widgets/types';`
Add a private field near the other state: `private dashboards = new Map<string, DashboardLayout>();`
Add these methods (after `getWellDetail`):
```ts
  private dashboardKey(ownerId: string): string {
    return `valor:dashboard:${ownerId}`;
  }

  private get browserStorage(): Storage | null {
    const g = globalThis as unknown as { localStorage?: Storage };
    return g.localStorage ?? null;
  }

  async getDashboard(ownerId: string): Promise<DashboardLayout> {
    const store = this.browserStorage;
    if (store) {
      const raw = store.getItem(this.dashboardKey(ownerId));
      if (raw) {
        try {
          return JSON.parse(raw) as DashboardLayout;
        } catch {
          /* fall through to default */
        }
      }
    } else if (this.dashboards.has(ownerId)) {
      return this.dashboards.get(ownerId)!;
    }
    return createDefaultDashboard(ownerId);
  }

  async saveDashboard(layout: DashboardLayout): Promise<void> {
    const store = this.browserStorage;
    if (store) {
      store.setItem(this.dashboardKey(layout.ownerId), JSON.stringify(layout));
    } else {
      this.dashboards.set(layout.ownerId, layout);
    }
  }
```

- [ ] **Step 5: Run to verify it passes**

Run: `corepack pnpm --filter @valor/core test` → all pass (Task-1 + persistence tests added). `corepack pnpm --filter @valor/core exec tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**
```bash
git add packages/core/src/repository.ts packages/core/src/mock-repository.ts packages/core/test/dashboard.test.ts
git commit -m "feat(core): dashboard persistence on the repository (localStorage-backed mock)"
```

---

## Task 3: Web widget registry + data hook (TDD registry)

**Files:** Create `apps/web/lib/widgets/registry.ts`, `apps/web/lib/use-repo-data.ts`; Test `apps/web/__tests__/registry.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/registry.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { registerWidget, getWidget, listWidgets, clearRegistry } from '@/lib/widgets/registry';
import type { WidgetDefinition } from '@valor/core';

const def: WidgetDefinition = {
  id: 'demo', title: 'Demo', description: 'd', category: 'data', defaultSize: { w: 4, h: 4 },
};
function Demo() { return null; }

describe('widget registry', () => {
  beforeEach(() => clearRegistry());

  it('registers and looks up a widget', () => {
    registerWidget(def, Demo);
    expect(getWidget('demo')?.def.title).toBe('Demo');
    expect(getWidget('demo')?.Component).toBe(Demo);
  });

  it('lists registered widget definitions', () => {
    registerWidget(def, Demo);
    expect(listWidgets().map((d) => d.id)).toEqual(['demo']);
  });

  it('returns undefined for an unknown id', () => {
    expect(getWidget('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `corepack pnpm --filter @valor/web test registry`
Expected: FAIL — cannot resolve `@/lib/widgets/registry`.

- [ ] **Step 3: Implement the registry**

Create `apps/web/lib/widgets/registry.ts`:
```ts
import type { ComponentType } from 'react';
import type { WidgetDefinition } from '@valor/core';

export type WidgetSurface = 'card' | 'page';
export interface WidgetProps {
  config?: Record<string, unknown>;
  surface: WidgetSurface;
}
export type WidgetComponent = ComponentType<WidgetProps>;

export interface RegistryEntry {
  def: WidgetDefinition;
  Component: WidgetComponent;
}

const registry = new Map<string, RegistryEntry>();

export function registerWidget(def: WidgetDefinition, Component: WidgetComponent): void {
  registry.set(def.id, { def, Component });
}
export function getWidget(id: string): RegistryEntry | undefined {
  return registry.get(id);
}
export function listWidgets(): WidgetDefinition[] {
  return [...registry.values()].map((e) => e.def);
}
/** Test-only: reset the module-global registry between tests. */
export function clearRegistry(): void {
  registry.clear();
}
```

- [ ] **Step 4: Implement the data hook**

Create `apps/web/lib/use-repo-data.ts`:
```ts
'use client';

import { useEffect, useState } from 'react';

/** Runs an async repo fetcher once on mount; returns { data, loading }. */
export function useRepoData<T>(fetcher: () => Promise<T>): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetcher().then((d) => {
      if (active) {
        setData(d);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, loading };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `corepack pnpm --filter @valor/web test registry` → 3 passing.

- [ ] **Step 6: Commit**
```bash
git add apps/web/lib/widgets/registry.ts apps/web/lib/use-repo-data.ts apps/web/__tests__/registry.test.ts
git commit -m "feat(web): widget registry + client data hook"
```

---

## Task 4: react-grid-layout install + WidgetCard chrome (RTL)

**Files:** Modify `apps/web/package.json`, `apps/web/vitest.setup.ts`; Create `apps/web/components/widgets/widget-card.tsx`; Test `apps/web/__tests__/widget-card.test.tsx`.

- [ ] **Step 1: Install react-grid-layout**

Run: `corepack pnpm --filter @valor/web add react-grid-layout@^2.2.3`
(It pulls `react-resizable`. Peer `react >= 16.3.0` → React 19 OK.)

- [ ] **Step 2: Add jsdom polyfills the grid needs (test setup)**

Append to `apps/web/vitest.setup.ts`:
```ts
// react-grid-layout uses ResizeObserver + matchMedia, absent in jsdom.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;
if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
  })) as unknown as typeof window.matchMedia;
}
```

- [ ] **Step 3: Write the failing test**

Create `apps/web/__tests__/widget-card.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetCard } from '@/components/widgets/widget-card';

describe('WidgetCard', () => {
  it('renders the title and body', () => {
    render(<WidgetCard title="Active Jobs">body-here</WidgetCard>);
    expect(screen.getByText('Active Jobs')).toBeInTheDocument();
    expect(screen.getByText('body-here')).toBeInTheDocument();
  });

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<WidgetCard title="Active Jobs" onRemove={onRemove}>x</WidgetCard>);
    fireEvent.click(screen.getByLabelText(/remove active jobs/i));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 4: Run to verify it fails**

Run: `corepack pnpm --filter @valor/web test widget-card`
Expected: FAIL — cannot resolve `@/components/widgets/widget-card`.

- [ ] **Step 5: Implement**

Create `apps/web/components/widgets/widget-card.tsx`:
```tsx
'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function WidgetCard({
  title,
  icon,
  onRemove,
  children,
}: {
  title: string;
  icon?: ReactNode;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="glass flex h-full flex-col overflow-hidden rounded-xl">
      <div className="widget-drag-handle flex cursor-move items-center gap-2 border-b border-border/40 px-3 py-2">
        {icon}
        <span className="font-display text-sm text-cream">{title}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${title}`}
            className="ml-auto rounded p-1 text-muted-foreground hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </div>
  );
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `corepack pnpm --filter @valor/web test widget-card` → 2 passing.

- [ ] **Step 7: Commit**
```bash
git add apps/web/package.json apps/web/vitest.setup.ts apps/web/components/widgets/widget-card.tsx apps/web/__tests__/widget-card.test.tsx pnpm-lock.yaml
git commit -m "feat(web): install react-grid-layout + WidgetCard chrome"
```

---

## Task 5: Widget catalog (RTL)

**Files:** Create `apps/web/components/widgets/widget-catalog.tsx`; Test `apps/web/__tests__/widget-catalog.test.tsx`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/widget-catalog.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetCatalog } from '@/components/widgets/widget-catalog';
import { registerWidget, clearRegistry } from '@/lib/widgets/registry';

function Noop() { return null; }

describe('WidgetCatalog', () => {
  beforeEach(() => {
    clearRegistry();
    registerWidget({ id: 'a', title: 'Calc A', description: 'd', category: 'compute', defaultSize: { w: 4, h: 4 } }, Noop);
    registerWidget({ id: 'b', title: 'Data B', description: 'd', category: 'data', defaultSize: { w: 4, h: 4 } }, Noop);
  });

  it('lists registered widgets under their category headings', () => {
    render(<WidgetCatalog onAdd={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Calculators')).toBeInTheDocument();
    expect(screen.getByText('Calc A')).toBeInTheDocument();
    expect(screen.getByText('Data B')).toBeInTheDocument();
  });

  it('calls onAdd with the widget id', () => {
    const onAdd = vi.fn();
    render(<WidgetCatalog onAdd={onAdd} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /add calc a/i }));
    expect(onAdd).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `corepack pnpm --filter @valor/web test widget-catalog`
Expected: FAIL — cannot resolve `@/components/widgets/widget-catalog`.

- [ ] **Step 3: Implement**

Create `apps/web/components/widgets/widget-catalog.tsx`:
```tsx
'use client';

import type { WidgetCategory } from '@valor/core';
import { listWidgets } from '@/lib/widgets/registry';

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  compute: 'Calculators',
  data: 'Data',
  report: 'Reports',
  embed: 'Embeds',
};
const ORDER: WidgetCategory[] = ['compute', 'data', 'report', 'embed'];

export function WidgetCatalog({
  onAdd,
  onClose,
}: {
  onAdd: (widgetId: string) => void;
  onClose: () => void;
}) {
  const all = listWidgets();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass-strong w-full max-w-lg rounded-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg text-cream">Add widget</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground">✕</button>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-auto">
          {ORDER.map((cat) => {
            const items = all.filter((w) => w.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <div className="eyebrow mb-2">{CATEGORY_LABELS[cat]}</div>
                <div className="space-y-2">
                  {items.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      aria-label={`Add ${w.title}`}
                      onClick={() => onAdd(w.id)}
                      className="flex w-full items-center gap-3 rounded-md border border-border/40 p-3 text-left hover:border-gold/40"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm text-cream">{w.title}</span>
                        <span className="block text-xs text-muted-foreground">{w.description}</span>
                      </span>
                      <span className="ml-auto text-sm text-gold">Add</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `corepack pnpm --filter @valor/web test widget-catalog` → 2 passing.

- [ ] **Step 5: Commit**
```bash
git add apps/web/components/widgets/widget-catalog.tsx apps/web/__tests__/widget-catalog.test.tsx
git commit -m "feat(web): add-widget catalog"
```

---

## Task 6: Dashboard host + page + nav (RTL)

**Files:** Create `apps/web/components/widgets/dashboard.tsx`, `apps/web/app/(hub)/dashboard/page.tsx`; Modify `apps/web/app/page.tsx`, `apps/web/components/app-shell.tsx`; Test `apps/web/__tests__/dashboard.test.tsx`.

> This task depends on the widget modules existing for a meaningful render; Task 7 registers them. The RTL test here registers its own fake widgets, so it does not depend on Task 7.

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/dashboard.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dashboard } from '@/components/widgets/dashboard';
import { registerWidget, clearRegistry } from '@/lib/widgets/registry';

function Box({ surface }: { surface: string }) { return <div>box-{surface}</div>; }

beforeEach(() => {
  localStorage.clear(); // jsdom provides localStorage; clear so tests don't share saved layouts
  clearRegistry();
  for (const id of ['kpi-strip', 'active-jobs', 'asset-tree', 'hydraulics']) {
    registerWidget(
      { id, title: id, description: 'd', category: 'data', defaultSize: { w: 4, h: 4 } },
      Box,
    );
  }
  registerWidget(
    { id: 'extra', title: 'Extra', description: 'd', category: 'compute', defaultSize: { w: 4, h: 4 } },
    Box,
  );
});

describe('Dashboard', () => {
  it('renders the default widgets', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getAllByText('box-card').length).toBe(4));
    expect(screen.getByText('hydraulics')).toBeInTheDocument();
  });

  it('adds a widget via the catalog and removes one', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getAllByText('box-card').length).toBe(4));
    fireEvent.click(screen.getByRole('button', { name: /add widget/i }));
    fireEvent.click(screen.getByRole('button', { name: /add extra/i }));
    await waitFor(() => expect(screen.getAllByText('box-card').length).toBe(5));
    fireEvent.click(screen.getAllByLabelText(/remove hydraulics/i)[0]);
    await waitFor(() => expect(screen.getAllByText('box-card').length).toBe(4));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `corepack pnpm --filter @valor/web test __tests__/dashboard`
Expected: FAIL — cannot resolve `@/components/widgets/dashboard`.

- [ ] **Step 3: Implement the dashboard host**

Create `apps/web/components/widgets/dashboard.tsx` (confirm `Responsive` / `WidthProvider` / `Layout` are the export names in the installed `react-grid-layout@2.2.3` — the API is stable from 1.x; adjust only if the package changed them):
```tsx
'use client';

import { useEffect, useState } from 'react';
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Plus } from 'lucide-react';
import { DEMO_USER_ID, type DashboardLayout, type WidgetInstance } from '@valor/core';
import { getRepo } from '@/lib/repo';
import { getWidget } from '@/lib/widgets/registry';
import { WidgetCard } from '@/components/widgets/widget-card';
import { WidgetCatalog } from '@/components/widgets/widget-catalog';

const ResponsiveGridLayout = WidthProvider(Responsive);

let counter = 0;
function newInstanceId(): string {
  counter += 1;
  return `w-${Date.now()}-${counter}`;
}

export function Dashboard() {
  const repo = getRepo();
  const [dash, setDash] = useState<DashboardLayout | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    repo.getDashboard(DEMO_USER_ID).then(setDash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!dash) return <div className="text-sm text-muted-foreground">Loading dashboard…</div>;

  const persist = (next: DashboardLayout) => {
    setDash(next);
    void repo.saveDashboard(next);
  };

  const onLayoutChange = (current: Layout[]) => {
    const byId = new Map(current.map((l) => [l.i, l]));
    persist({
      ...dash,
      widgets: dash.widgets.map((w) => {
        const l = byId.get(w.instanceId);
        return l ? { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } } : w;
      }),
    });
  };

  const addWidget = (widgetId: string) => {
    const def = getWidget(widgetId)?.def;
    if (!def) return;
    const inst: WidgetInstance = {
      instanceId: newInstanceId(),
      widgetId,
      layout: { x: 0, y: Infinity, w: def.defaultSize.w, h: def.defaultSize.h },
    };
    persist({ ...dash, widgets: [...dash.widgets, inst] });
    setCatalogOpen(false);
  };

  const removeWidget = (instanceId: string) =>
    persist({ ...dash, widgets: dash.widgets.filter((w) => w.instanceId !== instanceId) });

  const lgLayout: Layout[] = dash.widgets.map((w) => ({
    i: w.instanceId,
    x: w.layout.x,
    y: w.layout.y,
    w: w.layout.w,
    h: w.layout.h,
    minW: getWidget(w.widgetId)?.def.minSize?.w,
    minH: getWidget(w.widgetId)?.def.minSize?.h,
  }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl text-cream">Dashboard</h1>
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-sm text-gold-light"
        >
          <Plus className="h-4 w-4" /> Add widget
        </button>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: lgLayout }}
        breakpoints={{ lg: 1024, md: 768, sm: 0 }}
        cols={{ lg: 12, md: 8, sm: 1 }}
        rowHeight={36}
        draggableHandle=".widget-drag-handle"
        onLayoutChange={(current) => onLayoutChange(current)}
        isBounded
      >
        {dash.widgets.map((w) => {
          const entry = getWidget(w.widgetId);
          return (
            <div key={w.instanceId}>
              <WidgetCard title={entry?.def.title ?? w.widgetId} onRemove={() => removeWidget(w.instanceId)}>
                {entry ? (
                  <entry.Component config={w.config} surface="card" />
                ) : (
                  <div className="text-xs text-red-400">Unknown widget: {w.widgetId}</div>
                )}
              </WidgetCard>
            </div>
          );
        })}
      </ResponsiveGridLayout>

      {catalogOpen && <WidgetCatalog onAdd={addWidget} onClose={() => setCatalogOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `corepack pnpm --filter @valor/web test __tests__/dashboard` → 2 passing.

- [ ] **Step 5: Create the route + nav + redirect**

Create `apps/web/app/(hub)/dashboard/page.tsx`:
```tsx
import '@/widgets';
import { Dashboard } from '@/components/widgets/dashboard';

export default function DashboardPage() {
  return <Dashboard />;
}
```
(`import '@/widgets'` runs the registration side-effects before the dashboard reads the registry. Task 7 creates `apps/web/widgets/index.ts`; until then, create a temporary empty `apps/web/widgets/index.ts` containing `export {};` so this compiles.)

Create `apps/web/widgets/index.ts` (placeholder; Task 7 fills it):
```ts
export {};
```

Modify `apps/web/app/page.tsx` to redirect to the dashboard:
```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
```

In `apps/web/components/app-shell.tsx`: add `LayoutDashboard` to the lucide import and a nav entry as the first item:
- Change `import { Activity, Layers, Gauge } from 'lucide-react';`
  to `import { Activity, Layers, Gauge, LayoutDashboard } from 'lucide-react';`
- Change the `NAV` array to:
```tsx
const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/jobs', label: 'Active Jobs', icon: Activity },
  { href: '/assets', label: 'Assets', icon: Layers },
  { href: '/tools/hydraulics', label: 'Hydraulics', icon: Gauge },
];
```

- [ ] **Step 6: Verify build + tests**

Run:
```bash
corepack pnpm --filter @valor/web exec tsc --noEmit
corepack pnpm --filter @valor/web build
corepack pnpm --filter @valor/web test
```
Expected: tsc clean; build compiles `/dashboard`; web tests pass.

- [ ] **Step 7: Commit**
```bash
git add apps/web/components/widgets/dashboard.tsx "apps/web/app/(hub)/dashboard/page.tsx" apps/web/app/page.tsx apps/web/components/app-shell.tsx apps/web/widgets/index.ts apps/web/__tests__/dashboard.test.tsx
git commit -m "feat(web): composable dashboard host, route, and nav"
```

---

## Task 7: Migrate existing screens to widgets + stubs

**Files:** Create `apps/web/widgets/{kpi-strip,active-jobs,asset-tree,hydraulics}.widget.tsx`, `{daily-report,power-bi}.stub.tsx`; Modify `apps/web/widgets/index.ts`.

- [ ] **Step 1: KPI strip widget**

Create `apps/web/widgets/kpi-strip.widget.tsx`:
```tsx
'use client';
import { Gauge } from 'lucide-react';
import { registerWidget } from '@/lib/widgets/registry';
import { KpiStrip } from '@/components/kpi-strip';
import { useRepoData } from '@/lib/use-repo-data';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';

function KpiStripWidget() {
  const { data } = useRepoData(() => getRepo().listJobs(DEMO_ORG_ID));
  return data ? <KpiStrip jobs={data} /> : <div className="text-xs text-muted-foreground">Loading…</div>;
}

registerWidget(
  { id: 'kpi-strip', title: 'KPI Strip', description: 'Active / executing / planned job counts.', category: 'data', defaultSize: { w: 12, h: 2 }, minSize: { w: 4, h: 2 } },
  KpiStripWidget,
);
export {};
```

- [ ] **Step 2: Active Jobs widget**

Create `apps/web/widgets/active-jobs.widget.tsx`:
```tsx
'use client';
import { registerWidget } from '@/lib/widgets/registry';
import { JobsBoard } from '@/components/jobs-board';
import { useRepoData } from '@/lib/use-repo-data';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';

function ActiveJobsWidget() {
  const { data } = useRepoData(() => getRepo().listJobs(DEMO_ORG_ID));
  return data ? <JobsBoard jobs={data} /> : <div className="text-xs text-muted-foreground">Loading…</div>;
}

registerWidget(
  { id: 'active-jobs', title: 'Active Jobs', description: 'Jobs by lifecycle phase.', category: 'data', defaultSize: { w: 8, h: 8 }, minSize: { w: 4, h: 5 } },
  ActiveJobsWidget,
);
export {};
```

- [ ] **Step 3: Asset Tree widget**

Create `apps/web/widgets/asset-tree.widget.tsx`:
```tsx
'use client';
import { registerWidget } from '@/lib/widgets/registry';
import { AssetTree } from '@/components/asset-tree';
import { useRepoData } from '@/lib/use-repo-data';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';

function AssetTreeWidget() {
  const { data } = useRepoData(() => getRepo().getAssetTree(DEMO_ORG_ID));
  return data ? <AssetTree tree={data} /> : <div className="text-xs text-muted-foreground">Loading…</div>;
}

registerWidget(
  { id: 'asset-tree', title: 'Asset Hierarchy', description: 'Fields → pads → wells.', category: 'data', defaultSize: { w: 4, h: 8 }, minSize: { w: 3, h: 4 } },
  AssetTreeWidget,
);
export {};
```

- [ ] **Step 4: Hydraulics widget**

Create `apps/web/widgets/hydraulics.widget.tsx`:
```tsx
'use client';
import { registerWidget } from '@/lib/widgets/registry';
import { HydraulicsPanel } from '@/components/hydraulics-panel';

function HydraulicsWidget() {
  return <HydraulicsPanel />;
}

registerWidget(
  { id: 'hydraulics', title: 'Hydraulics & Circulation', description: 'Annular volumes, pump output, bottoms-up, pressures.', category: 'compute', defaultSize: { w: 8, h: 12 }, minSize: { w: 5, h: 8 } },
  HydraulicsWidget,
);
export {};
```

- [ ] **Step 5: Stub widgets (report + embed)**

Create `apps/web/widgets/daily-report.stub.tsx`:
```tsx
'use client';
import { registerWidget } from '@/lib/widgets/registry';

function DailyReportStub() {
  return <div className="text-sm text-muted-foreground">Daily report — coming soon.</div>;
}

registerWidget(
  { id: 'daily-report', title: 'Daily Report', description: 'Generated daily morning report.', category: 'report', defaultSize: { w: 6, h: 6 } },
  DailyReportStub,
);
export {};
```

Create `apps/web/widgets/power-bi.stub.tsx`:
```tsx
'use client';
import { registerWidget } from '@/lib/widgets/registry';

function PowerBiStub() {
  return <div className="text-sm text-muted-foreground">Power BI embed — coming soon (O365 integration phase).</div>;
}

registerWidget(
  { id: 'power-bi', title: 'Power BI', description: 'Embedded Power BI report.', category: 'embed', defaultSize: { w: 6, h: 6 } },
  PowerBiStub,
);
export {};
```

- [ ] **Step 6: Register all in the barrel**

Replace `apps/web/widgets/index.ts` with:
```ts
import './kpi-strip.widget';
import './active-jobs.widget';
import './asset-tree.widget';
import './hydraulics.widget';
import './daily-report.stub';
import './power-bi.stub';
export {};
```

- [ ] **Step 7: Verify build + tests + runtime**

Run:
```bash
corepack pnpm --filter @valor/core test
corepack pnpm --filter @valor/web exec tsc --noEmit
corepack pnpm --filter @valor/web build
(corepack pnpm --filter @valor/web start -- -p 3100 &) ; sleep 6
curl -s http://localhost:3100/dashboard | grep -o "Add widget"
# stop the server on port 3100
```
Expected: all green; build compiles `/dashboard`; curl finds "Add widget".

- [ ] **Step 8: Commit**
```bash
git add apps/web/widgets
git commit -m "feat(web): migrate KPI/jobs/asset-tree/hydraulics to widgets + report/embed stubs"
```

---

## Task 8: Finish — comprehensive review, test-after-resolution, merge

Follow `docs/superpowers/process/review-pipeline.md` gates 5–8.

- [ ] **Step 1: Final verification** — `corepack pnpm --filter @valor/core test`; `corepack pnpm --filter @valor/web test`; `corepack pnpm --filter @valor/web build`.
- [ ] **Step 2: Push + PR**
```bash
git push -u origin feat/widget-architecture
gh pr create --base master --head feat/widget-architecture \
  --title "Widget architecture: registry + composable dashboard" \
  --body "Implements docs/superpowers/specs/2026-06-07-widget-architecture-design.md — widget registry + react-grid-layout dashboard (add/remove/move/resize) with repository-seam (localStorage-backed) persistence; existing screens migrated to widgets + report/embed stubs.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
- [ ] **Step 3: Comprehensive review (gate 5)** — dispatch the multi-dimensional value×context×intent pass (opus) + the dimensioned CodeRabbit App review; collect findings + the recommended test list.
- [ ] **Step 4: Resolve (gate 6)** — fix/justify every finding.
- [ ] **Step 5: Test-after-resolution (gate 7)** — add the recommended tests; re-verify all green.
- [ ] **Step 6: Triage CodeRabbit/Copilot, then merge.**

---

## Definition of Done
- `corepack pnpm --filter @valor/core test` and `--filter @valor/web test` both green; web build compiles `/dashboard`.
- `/dashboard` is the landing; shows the 4 default widgets; "+ Add widget" adds from the catalog (incl. the report + embed stubs); widgets drag/resize/remove; layout survives reload (localStorage).
- Adding a future widget = one self-registering `*.widget.tsx` + entry in `widgets/index.ts` — no dashboard changes.
- Existing full-page routes (`/jobs`, `/assets`, `/wells/[id]`, `/tools/hydraulics`) still work.
- All UI reads only via `@valor/core` + `@/lib/repo`; persistence behind the `Repository` seam.

## Next increment
Per-instance widget config (⚙ — e.g., scope an Active Jobs widget to one asset); multiple named dashboards; then the Supabase `dashboards` table behind `getDashboard`/`saveDashboard`.
```
