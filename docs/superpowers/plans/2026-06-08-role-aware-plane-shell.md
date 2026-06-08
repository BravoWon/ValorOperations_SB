# Role-aware 4-plane shell (Slice A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the hub's sidebar into the four planes (Operate · Visualize · Administer · Data) and make the surface adapt to a demo role — realizing the "role-aware single surface" decision with the routes that already exist, zero data-model change.

**Architecture:** A pure presentation/IA layer. `lib/role.ts` (pure role ranking + cookie parse) and `lib/planes.ts` (plane→route→min-role registry) are data + pure functions. A client `RoleProvider`/`useRole` resolves the demo role from a `valor_demo_role` cookie. `app-shell.tsx` renders plane-grouped, role-filtered nav + a `RoleSwitcher`; a `RoleGate` in the hub layout shows a branded "not available" state for direct visits above the current role. No `@valor/core` change.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, lucide-react, Vitest + @testing-library/react (jsdom). Branch: `feat/ops-architecture-shell` (already created).

**Spec:** `docs/superpowers/specs/2026-06-08-operations-architecture-design.md` (the "Slice A" section).

---

## File Structure

- **Create `apps/web/lib/role.ts`** — pure: `Role` re-export, `ALL_ROLES`, `ROLE_RANK`, `DEFAULT_ROLE`, `ROLE_COOKIE`, `roleSatisfies(current,min)`, `parseRoleCookie(cookieString)`.
- **Create `apps/web/lib/planes.ts`** — `PlaneItem`/`Plane` types, `PLANES` registry (every current nav route + its min-role), `planesForRole(role)`, `minRoleForPath(pathname)`.
- **Create `apps/web/components/role-provider.tsx`** — client `RoleProvider` + `useRole()` (cookie-backed).
- **Create `apps/web/components/role-switcher.tsx`** — demo role `<select>`.
- **Create `apps/web/components/role-blocked.tsx`** — branded "not available for your role" state.
- **Create `apps/web/components/role-gate.tsx`** — client gate: pathname → min-role → children or `RoleBlocked`.
- **Modify `apps/web/components/app-shell.tsx`** — plane-grouped, role-filtered nav + `RoleSwitcher`.
- **Modify `apps/web/app/(hub)/layout.tsx`** — wrap with `RoleProvider` + `RoleGate` (preserve the static-export `AuthGate`).
- **Tests:** `apps/web/__tests__/role.test.ts`, `planes.test.ts`, `role-provider.test.tsx`, `app-shell.test.tsx`, `role-gate.test.tsx`.

Commands (run from the repo root):
- One test file: `corepack pnpm --filter @valor/web test -- <name>`
- Full web tests: `corepack pnpm --filter @valor/web test`
- Typecheck: `corepack pnpm --filter @valor/web typecheck`

---

### Task 1: Pure role model (`lib/role.ts`)

**Files:**
- Create: `apps/web/lib/role.ts`
- Test: `apps/web/__tests__/role.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/__tests__/role.test.ts
import { describe, it, expect } from 'vitest';
import { roleSatisfies, parseRoleCookie, ROLE_RANK, ALL_ROLES } from '@/lib/role';

describe('roleSatisfies', () => {
  it('owner satisfies every minimum', () => {
    for (const r of ALL_ROLES) expect(roleSatisfies('owner', r)).toBe(true);
  });
  it('viewer satisfies only viewer', () => {
    expect(roleSatisfies('viewer', 'viewer')).toBe(true);
    expect(roleSatisfies('viewer', 'field')).toBe(false);
  });
  it('equal rank satisfies', () => {
    expect(roleSatisfies('ops', 'ops')).toBe(true);
  });
});

describe('parseRoleCookie', () => {
  it('reads a valid role from the cookie string', () => {
    expect(parseRoleCookie('a=1; valor_demo_role=field; b=2')).toBe('field');
  });
  it('defaults to owner when absent or invalid', () => {
    expect(parseRoleCookie('')).toBe('owner');
    expect(parseRoleCookie('valor_demo_role=bogus')).toBe('owner');
  });
  it('every role has a numeric rank', () => {
    for (const r of ALL_ROLES) expect(typeof ROLE_RANK[r]).toBe('number');
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `corepack pnpm --filter @valor/web test -- role.test`
Expected: FAIL — cannot resolve `@/lib/role`.

- [ ] **Step 3: Implement `lib/role.ts`**

```ts
// apps/web/lib/role.ts
import type { Role } from '@valor/core';

export type { Role };

/** Privilege order, highest first. */
export const ALL_ROLES: Role[] = ['owner', 'admin', 'ops', 'field', 'vendor', 'viewer'];

/** Higher rank = more access. */
export const ROLE_RANK: Record<Role, number> = {
  owner: 5,
  admin: 4,
  ops: 3,
  field: 2,
  vendor: 1,
  viewer: 0,
};

export const DEFAULT_ROLE: Role = 'owner';
export const ROLE_COOKIE = 'valor_demo_role';

/** True when `current` is at least as privileged as `min`. */
export function roleSatisfies(current: Role, min: Role): boolean {
  return ROLE_RANK[current] >= ROLE_RANK[min];
}

/** Read the demo role from a `document.cookie`-style string; default owner. */
export function parseRoleCookie(cookieString: string): Role {
  const hit = cookieString
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${ROLE_COOKIE}=`));
  const value = hit ? hit.slice(ROLE_COOKIE.length + 1) : '';
  return (ALL_ROLES as string[]).includes(value) ? (value as Role) : DEFAULT_ROLE;
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `corepack pnpm --filter @valor/web test -- role.test`
Expected: PASS (3 + describe blocks).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/role.ts apps/web/__tests__/role.test.ts
git commit -m "feat(web): pure demo-role model (rank + cookie parse)"
```

---

### Task 2: Plane registry (`lib/planes.ts`)

**Files:**
- Create: `apps/web/lib/planes.ts`
- Test: `apps/web/__tests__/planes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/__tests__/planes.test.ts
import { describe, it, expect } from 'vitest';
import { PLANES, planesForRole, minRoleForPath } from '@/lib/planes';
import { ALL_ROLES, ROLE_RANK } from '@/lib/role';

// The flat nav that existed before Slice A — every one must be placed exactly once.
const EXISTING_NAV = [
  '/dashboard', '/jobs', '/rig-day', '/assets',
  '/tools/hydraulics', '/tools/directional',
  '/data-manager', '/office-ops', '/data-studio', '/local-db',
];

describe('planes registry', () => {
  it('places every existing nav route in exactly one plane, no extras', () => {
    const hrefs = PLANES.flatMap((p) => p.items.map((i) => i.href));
    for (const route of EXISTING_NAV) {
      expect(hrefs.filter((h) => h === route)).toHaveLength(1);
    }
    expect(hrefs.length).toBe(EXISTING_NAV.length);
  });

  it('every item has a valid min role', () => {
    for (const p of PLANES) {
      for (const i of p.items) {
        expect(ALL_ROLES).toContain(i.minRole);
        expect(typeof ROLE_RANK[i.minRole]).toBe('number');
      }
    }
  });

  it('planesForRole hides above-role items and drops empty planes', () => {
    const viewerHrefs = planesForRole('viewer').flatMap((p) => p.items.map((i) => i.href));
    expect(viewerHrefs).toContain('/dashboard');
    expect(viewerHrefs).not.toContain('/data-manager'); // admin-only
    expect(planesForRole('viewer').find((p) => p.id === 'administer')).toBeUndefined();
    expect(planesForRole('owner').flatMap((p) => p.items).length).toBe(EXISTING_NAV.length);
  });

  it('minRoleForPath matches items and defaults unknown routes to viewer', () => {
    expect(minRoleForPath('/data-manager')).toBe('admin');
    expect(minRoleForPath('/rig-day')).toBe('ops');
    expect(minRoleForPath('/wells/well-lf1')).toBe('viewer'); // not in registry → visible to all
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `corepack pnpm --filter @valor/web test -- planes.test`
Expected: FAIL — cannot resolve `@/lib/planes`.

- [ ] **Step 3: Implement `lib/planes.ts`**

```ts
// apps/web/lib/planes.ts
import type { ComponentType } from 'react';
import {
  LayoutDashboard, Activity, Clock, Layers, Gauge, Compass,
  Database, Building2, BarChart3, HardDrive,
  HardHat, Eye, SlidersHorizontal, Server,
} from 'lucide-react';
import type { Role } from '@/lib/role';
import { roleSatisfies } from '@/lib/role';

export interface PlaneItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  minRole: Role;
}

export interface Plane {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  items: PlaneItem[];
}

export const PLANES: Plane[] = [
  {
    id: 'operate', label: 'Operate', icon: HardHat,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, minRole: 'viewer' },
      { href: '/jobs', label: 'Active Jobs', icon: Activity, minRole: 'field' },
      { href: '/rig-day', label: 'Rig Day', icon: Clock, minRole: 'ops' },
      { href: '/assets', label: 'Assets', icon: Layers, minRole: 'viewer' },
    ],
  },
  {
    id: 'visualize', label: 'Visualize', icon: Eye,
    items: [
      { href: '/data-studio', label: 'Data Studio', icon: BarChart3, minRole: 'viewer' },
      { href: '/tools/hydraulics', label: 'Hydraulics', icon: Gauge, minRole: 'field' },
      { href: '/tools/directional', label: 'Directional', icon: Compass, minRole: 'field' },
    ],
  },
  {
    id: 'administer', label: 'Administer', icon: SlidersHorizontal,
    items: [
      { href: '/data-manager', label: 'Data Manager', icon: Database, minRole: 'admin' },
      { href: '/office-ops', label: 'Office Ops', icon: Building2, minRole: 'admin' },
    ],
  },
  {
    id: 'data', label: 'Data', icon: Server,
    items: [
      { href: '/local-db', label: 'Local Database', icon: HardDrive, minRole: 'admin' },
    ],
  },
];

/** Planes with their items filtered to those the role may see; empty planes dropped. */
export function planesForRole(role: Role): Plane[] {
  return PLANES
    .map((p) => ({ ...p, items: p.items.filter((i) => roleSatisfies(role, i.minRole)) }))
    .filter((p) => p.items.length > 0);
}

/** Minimum role for a pathname; routes not in the registry are visible to all (viewer). */
export function minRoleForPath(pathname: string): Role {
  for (const p of PLANES) {
    for (const i of p.items) {
      if (pathname === i.href || pathname.startsWith(`${i.href}/`)) return i.minRole;
    }
  }
  return 'viewer';
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `corepack pnpm --filter @valor/web test -- planes.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/planes.ts apps/web/__tests__/planes.test.ts
git commit -m "feat(web): plane registry (4 planes, route→min-role)"
```

---

### Task 3: Role provider + switcher

**Files:**
- Create: `apps/web/components/role-provider.tsx`
- Create: `apps/web/components/role-switcher.tsx`
- Test: `apps/web/__tests__/role-provider.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/__tests__/role-provider.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoleProvider, useRole } from '@/components/role-provider';

function Probe() {
  const { role, setRole } = useRole();
  return (
    <div>
      <span data-testid="role">{role}</span>
      <button onClick={() => setRole('field')}>to-field</button>
    </div>
  );
}

describe('RoleProvider', () => {
  beforeEach(() => {
    document.cookie = 'valor_demo_role=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('defaults to owner on mount when no cookie', async () => {
    render(<RoleProvider><Probe /></RoleProvider>);
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('owner'));
  });

  it('setRole writes the cookie and updates context', async () => {
    render(<RoleProvider><Probe /></RoleProvider>);
    fireEvent.click(screen.getByText('to-field'));
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('field'));
    expect(document.cookie).toContain('valor_demo_role=field');
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `corepack pnpm --filter @valor/web test -- role-provider.test`
Expected: FAIL — cannot resolve `@/components/role-provider`.

- [ ] **Step 3: Implement the provider**

```tsx
// apps/web/components/role-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Role } from '@/lib/role';
import { DEFAULT_ROLE, ROLE_COOKIE, parseRoleCookie } from '@/lib/role';

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
}

const RoleContext = createContext<RoleContextValue>({ role: DEFAULT_ROLE, setRole: () => {} });

export function RoleProvider({ children }: { children: React.ReactNode }) {
  // Start at the default; refine from the cookie after mount (so SSR/first paint
  // never hides content for the default owner, mirroring AuthGate's approach).
  const [role, setRoleState] = useState<Role>(DEFAULT_ROLE);

  useEffect(() => {
    setRoleState(parseRoleCookie(document.cookie));
  }, []);

  const setRole = (r: Role) => {
    document.cookie = `${ROLE_COOKIE}=${r}; path=/; max-age=86400; samesite=lax`;
    setRoleState(r);
  };

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}
```

- [ ] **Step 4: Implement the switcher**

```tsx
// apps/web/components/role-switcher.tsx
'use client';

import type { Role } from '@/lib/role';
import { ALL_ROLES } from '@/lib/role';
import { useRole } from '@/components/role-provider';

/** Demo affordance: switch the signed-in role to see the surface adapt. */
export function RoleSwitcher() {
  const { role, setRole } = useRole();
  return (
    <label className="mb-6 flex items-center gap-2 px-2">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground/70">Role</span>
      <select
        aria-label="Demo role"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className="flex-1 rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-wider text-cream outline-none transition-colors focus:border-gold/50"
      >
        {ALL_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `corepack pnpm --filter @valor/web test -- role-provider.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/role-provider.tsx apps/web/components/role-switcher.tsx apps/web/__tests__/role-provider.test.tsx
git commit -m "feat(web): cookie-backed RoleProvider + demo RoleSwitcher"
```

---

### Task 4: Plane-grouped, role-filtered sidebar (`app-shell.tsx`)

**Files:**
- Modify: `apps/web/components/app-shell.tsx` (replace the flat `NAV` array + flat `<nav>` with plane groups from `planesForRole(role)`; add `RoleSwitcher`)
- Test: `apps/web/__tests__/app-shell.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/__tests__/app-shell.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ role: 'viewer' as string }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('@/components/role-provider', () => ({
  useRole: () => ({ role: h.role, setRole: () => {} }),
}));

import { AppShell } from '@/components/app-shell';

describe('AppShell plane-grouped + role-gated nav', () => {
  it('viewer sees viewer routes but not admin routes or empty plane groups', () => {
    h.role = 'viewer';
    render(<AppShell tree={[]}>x</AppShell>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Operate')).toBeInTheDocument();
    expect(screen.queryByText('Data Manager')).not.toBeInTheDocument();
    expect(screen.queryByText('Administer')).not.toBeInTheDocument();
  });

  it('owner sees every plane group and route', () => {
    h.role = 'owner';
    render(<AppShell tree={[]}>x</AppShell>);
    for (const label of ['Operate', 'Visualize', 'Administer', 'Data']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Data Manager')).toBeInTheDocument();
    expect(screen.getByText('Local Database')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `corepack pnpm --filter @valor/web test -- app-shell.test`
Expected: FAIL — the flat shell renders all routes (no plane headings; "Data Manager" present for viewer).

- [ ] **Step 3: Replace `apps/web/components/app-shell.tsx` with the plane-grouped version**

Replace the ENTIRE file with:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AssetTreeNode } from '@valor/core';
import { Home } from 'lucide-react';
import { AssetTree } from '@/components/asset-tree';
import { RoleSwitcher } from '@/components/role-switcher';
import { useRole } from '@/components/role-provider';
import { planesForRole } from '@/lib/planes';
import { cn } from '@/lib/utils';

export function AppShell({ tree, children }: { tree: AssetTreeNode[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useRole();
  const planes = planesForRole(role);

  return (
    <div className="flex min-h-screen">
      <aside className="glass-strong sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-y-0 border-l-0 border-r border-r-[rgba(201,168,76,0.18)] px-4 py-6">
        {/* Back-to-workspaces affordance + active-workspace label */}
        <div className="mb-5 px-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-gold-light"
          >
            <Home className="h-3 w-3" />
            Workspaces
          </Link>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_8px_0_rgba(201,168,76,0.7)]" />
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-gold/80">
              Operations Hub
            </span>
          </div>
        </div>

        {/* Brand mark */}
        <Link href="/dashboard" className="group mb-8 flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-gold/40 bg-gold/10 font-display text-lg text-gold-light shadow-[0_0_18px_-6px_rgba(201,168,76,0.6)]">
            V
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-base font-medium tracking-tight text-cream">Valor</span>
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-gold/70">Operations</span>
          </span>
        </Link>

        <RoleSwitcher />

        <nav className="space-y-5">
          {planes.map((plane) => {
            const PlaneIcon = plane.icon;
            return (
              <div key={plane.id}>
                <div className="eyebrow mb-2 flex items-center gap-1.5 px-2">
                  <PlaneIcon className="h-3 w-3 text-gold/70" />
                  {plane.label}
                </div>
                <div className="space-y-1">
                  {plane.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                          active
                            ? 'bg-gold/12 text-gold-light'
                            : 'text-muted-foreground hover:bg-white/[0.04] hover:text-cream',
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gold" />
                        )}
                        <Icon className={cn('h-4 w-4', active ? 'text-gold' : 'text-muted-foreground/70')} strokeWidth={1.75} />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="hairline my-6 h-px" />

        <div className="eyebrow mb-3 px-2">Asset Hierarchy</div>
        <div className="flex-1">
          <AssetTree tree={tree} />
        </div>

        <div className="mt-6 px-2 pt-4">
          <div className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground/60">
            Valor Energy Partners
          </div>
          <div className="mt-1 font-mono text-[0.625rem] text-muted-foreground/40">
            operations.valorenp.com
          </div>
        </div>
      </aside>

      <main className="flex-1 px-6 py-8 md:px-8 lg:px-10">
        <div className="page-container">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `corepack pnpm --filter @valor/web test -- app-shell.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/app-shell.tsx apps/web/__tests__/app-shell.test.tsx
git commit -m "feat(web): plane-grouped, role-filtered sidebar + role switcher"
```

---

### Task 5: Direct-visit gate (`role-blocked.tsx` + `role-gate.tsx`)

**Files:**
- Create: `apps/web/components/role-blocked.tsx`
- Create: `apps/web/components/role-gate.tsx`
- Test: `apps/web/__tests__/role-gate.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/__tests__/role-gate.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ path: '/data-manager', role: 'viewer' as string }));
vi.mock('next/navigation', () => ({ usePathname: () => h.path }));
vi.mock('@/components/role-provider', () => ({ useRole: () => ({ role: h.role, setRole: () => {} }) }));

import { RoleGate } from '@/components/role-gate';

describe('RoleGate', () => {
  it('blocks a route above the current role', () => {
    h.path = '/data-manager'; h.role = 'viewer';
    render(<RoleGate><div>secret</div></RoleGate>);
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByText(/Not available for your role/i)).toBeInTheDocument();
  });

  it('renders children for a route at/below the current role', () => {
    h.path = '/dashboard'; h.role = 'viewer';
    render(<RoleGate><div>secret</div></RoleGate>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `corepack pnpm --filter @valor/web test -- role-gate.test`
Expected: FAIL — cannot resolve `@/components/role-gate`.

- [ ] **Step 3: Implement `role-blocked.tsx`**

```tsx
// apps/web/components/role-blocked.tsx
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

/** Branded "this route needs a higher role" state for direct visits. */
export function RoleBlocked({ required }: { required: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="animate-fade-up glass-strong w-full max-w-md rounded-xl px-8 py-10 text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold-light shadow-[0_0_28px_-8px_rgba(201,168,76,0.7)]">
          <ShieldAlert className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div className="eyebrow mb-2">Restricted</div>
        <h1 className="font-display text-2xl font-medium tracking-tight text-cream">
          Not available for your role
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This workspace requires the{' '}
          <span className="font-mono uppercase tracking-wider text-gold-light">{required}</span> role or higher.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center rounded-md border border-gold/30 bg-gold/[0.06] px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `role-gate.tsx`**

```tsx
// apps/web/components/role-gate.tsx
'use client';

import { usePathname } from 'next/navigation';
import { useRole } from '@/components/role-provider';
import { roleSatisfies } from '@/lib/role';
import { minRoleForPath } from '@/lib/planes';
import { RoleBlocked } from '@/components/role-blocked';

/** Gates hub content: if the current role can't see this path, show RoleBlocked. */
export function RoleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useRole();
  const min = minRoleForPath(pathname);
  if (!roleSatisfies(role, min)) return <RoleBlocked required={min} />;
  return <>{children}</>;
}
```

- [ ] **Step 5: Run the test, verify it passes**

Run: `corepack pnpm --filter @valor/web test -- role-gate.test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/role-blocked.tsx apps/web/components/role-gate.tsx apps/web/__tests__/role-gate.test.tsx
git commit -m "feat(web): RoleGate + branded RoleBlocked for direct visits"
```

---

### Task 6: Wire the hub layout

**Files:**
- Modify: `apps/web/app/(hub)/layout.tsx`

- [ ] **Step 1: Replace `apps/web/app/(hub)/layout.tsx` with the wired version**

```tsx
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { AppShell } from '@/components/app-shell';
import { AuthGate } from '@/components/auth-gate';
import { RoleProvider } from '@/components/role-provider';
import { RoleGate } from '@/components/role-gate';

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const tree = await getRepo().getAssetTree(DEMO_ORG_ID);

  // RoleProvider must wrap both the sidebar (role-filtered nav) and RoleGate
  // (direct-visit gate) so they share one role. RoleGate wraps the page content.
  const shell = (
    <AppShell tree={tree}>
      <RoleGate>{children}</RoleGate>
    </AppShell>
  );

  // Static export (GitHub Pages) also needs the client AuthGate (no middleware there);
  // dev/Vercel are gated by middleware, so AuthGate is skipped to keep SSR HTML.
  const gated = process.env.STATIC_EXPORT === 'true' ? <AuthGate>{shell}</AuthGate> : shell;

  return <RoleProvider>{gated}</RoleProvider>;
}
```

- [ ] **Step 2: Typecheck + full web test suite**

Run: `corepack pnpm --filter @valor/web typecheck`
Expected: exit 0.
Run: `corepack pnpm --filter @valor/web test`
Expected: all suites pass (the 5 new files + the previously-green suite).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(hub)/layout.tsx"
git commit -m "feat(web): wire RoleProvider + RoleGate into the hub layout"
```

---

### Task 7: Verify both builds + ship

**Files:** none (verification only)

- [ ] **Step 1: Normal production build (Middleware active, hub server-rendered)**

Run: `corepack pnpm --filter @valor/web build`
Expected: "Compiled successfully", routes listed, `ƒ Middleware` present, exit 0.

- [ ] **Step 2: Static export build (PowerShell, no MSYS path-mangling)**

Run (PowerShell):
```powershell
Remove-Item -Recurse -Force apps/web/.next, apps/web/out -ErrorAction SilentlyContinue
$env:STATIC_EXPORT='true'; $env:PAGES_BASE_PATH='ValorOperations_SB'
corepack pnpm --filter @valor/web build
```
Expected: "Generating static pages (20/20)", exit 0, `apps/web/out/dashboard/index.html` exists.

- [ ] **Step 3: Clean the export env + final typecheck**

Run: `corepack pnpm --filter @valor/web typecheck`
Expected: exit 0.

- [ ] **Step 4: Push the branch and open the PR**

```bash
git push -u origin feat/ops-architecture-shell
gh pr create --base master --head feat/ops-architecture-shell --title "feat: role-aware 4-plane shell (Slice A)" --body-file <a temp file describing the slice + test plan>
```
Then run the standard dual-bot review loop (CodeRabbit + Copilot), action-or-justify every finding, and merge per the established pipeline.

---

## Self-Review

**1. Spec coverage (Slice A section):**
- Plane registry (`planes.ts`) → Task 2 ✓
- Plane-grouped + role-gated sidebar (`app-shell.tsx`) → Task 4 ✓
- Role context resolving from cookie (`role.ts` + `role-provider.tsx`) → Tasks 1, 3 ✓ (uses a dedicated `valor_demo_role` cookie rather than overloading `valor_demo_auth`, which keeps the existing AuthGate untouched — same intent, safer)
- Role-gating hides above-role routes → Tasks 2 (`planesForRole`) + 4 ✓
- Direct-visit "not available" state → Task 5 (`RoleGate` + `RoleBlocked`) ✓
- Role switcher (demo affordance) → Task 3 (`role-switcher.tsx`) + Task 4 (mounted) ✓
- Zero `@valor/core` change → confirmed (only `apps/web/**`) ✓
- Passes normal + static-export builds → Task 7 ✓
- Tests: plane-registry integrity, role-resolver units, shell-gating render → Tasks 1, 2, 3, 4, 5 ✓

**2. Placeholder scan:** none — every step has full code or an exact command.

**3. Type consistency:** `Role` (re-exported from `@valor/core`), `roleSatisfies`, `parseRoleCookie`, `ROLE_COOKIE`, `ALL_ROLES`, `planesForRole`, `minRoleForPath`, `useRole`, `RoleProvider`, `RoleGate`, `RoleBlocked` are named identically across all tasks. The `valor_demo_role` cookie name is consistent between `role.ts` (`ROLE_COOKIE`), `role-provider.tsx`, and the tests.
