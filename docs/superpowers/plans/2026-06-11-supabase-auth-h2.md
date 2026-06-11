# Supabase Auth — Slice H2 (Active-org context + switcher) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the org the data layer scopes to dynamic — derived from the signed-in user's memberships and held in a `valor_active_org` cookie both `getRepo` and `getServerRepo` read — instead of the static env `NEXT_PUBLIC_SUPABASE_ORG_ID`, with a switcher shown only when a user has more than one org.

**Architecture:** Approach A — a non-httpOnly `valor_active_org` cookie holds the active org; both data factories resolve `orgId = cookie ?? NEXT_PUBLIC_SUPABASE_ORG_ID`. `SupabaseRepository` already scopes every query by its constructor `orgId`, so this is the whole data-layer change. H1's `RequireMembership` evolves into `ActiveOrgProvider` (fetch memberships → gate + validate the cookie + provide org context); a sidebar `OrgSwitcher` appears only when >1 org. `supabaseConfigured()` and mock mode are unchanged.

**Tech Stack:** TypeScript, Next 15 App Router, React 19, `@supabase/ssr`, Tailwind, Vitest/jsdom. Spec: `docs/superpowers/specs/2026-06-11-supabase-auth-h2-design.md`. Branch: `feat/auth-h2`.

**Commands (from repo root):** Web: `corepack pnpm --filter @valor/web test -- <name>` / `test` / `typecheck` / `build`. Static export: `STATIC_EXPORT=true corepack pnpm --filter @valor/web build`.

**Constraints:** TDD (Vitest/jsdom; mock the browser client, `document.cookie`, `window.location.reload`). Both typechecks 0; normal build AND `STATIC_EXPORT=true` build exit 0. No `as any` (use `as unknown as`). Never `service_role` in `NEXT_PUBLIC_*`. Authorization only via `memberships`, never `user_metadata`. Mock mode byte-for-byte unchanged; `supabaseConfigured()` unchanged. End every commit body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

- **Create `apps/web/lib/active-org.ts`** — `ACTIVE_ORG_COOKIE`, pure `readActiveOrgCookie(value)`, `resolveActiveOrgClient()`, `writeActiveOrgCookie(orgId)`. No `@supabase` imports; safe to import anywhere (document access is inside function bodies only).
- **Create `apps/web/components/active-org-provider.tsx`** — `ActiveOrgProvider` (evolves `RequireMembership`) + `useActiveOrg()` hook + the context (all exported from this file).
- **Create `apps/web/components/org-switcher.tsx`** — sidebar switcher (dropdown when >1 org, static label when 1, nothing in mock mode).
- **Modify `apps/web/lib/repo.ts`** — `getRepo()` resolves `orgId` from the cookie.
- **Modify `apps/web/lib/server-repo.ts`** — `getServerRepo()` reads the cookie via `next/headers`.
- **Modify `apps/web/app/(hub)/layout.tsx`** — `ActiveOrgProvider` wraps `AppShell` (replaces `RequireMembership`).
- **Modify `apps/web/components/app-shell.tsx`** — render `<OrgSwitcher/>` after `<RoleSwitcher/>`.
- **Delete `apps/web/components/require-membership.tsx`** + **`apps/web/__tests__/require-membership.test.tsx`** — superseded.

---

### Task 1: `lib/active-org.ts` — cookie helpers (TDD)

**Files:** Create `apps/web/lib/active-org.ts`; Test `apps/web/__tests__/active-org.test.ts`.

- [ ] **Step 1: Write the failing test** — `apps/web/__tests__/active-org.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ACTIVE_ORG_COOKIE, readActiveOrgCookie, resolveActiveOrgClient, writeActiveOrgCookie } from '@/lib/active-org';

const ENV = '00000000-0000-0000-0000-0000000000ee';
const prev = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = ENV;
  document.cookie = `${ACTIVE_ORG_COOKIE}=; path=/; max-age=0`; // clear
});
afterEach(() => {
  if (prev === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ORG_ID;
  else process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = prev;
});

describe('readActiveOrgCookie', () => {
  it('returns the value when present', () => { expect(readActiveOrgCookie('abc')).toBe('abc'); });
  it('falls back to the env default when undefined or empty', () => {
    expect(readActiveOrgCookie(undefined)).toBe(ENV);
    expect(readActiveOrgCookie('')).toBe(ENV);
  });
});

describe('resolveActiveOrgClient + writeActiveOrgCookie', () => {
  it('returns the env default when no cookie is set', () => { expect(resolveActiveOrgClient()).toBe(ENV); });
  it('round-trips a written cookie', () => {
    writeActiveOrgCookie('org-123');
    expect(resolveActiveOrgClient()).toBe('org-123');
  });
});
```

- [ ] **Step 2: Run, verify fail** — `corepack pnpm --filter @valor/web test -- active-org` → FAIL (cannot resolve `@/lib/active-org`).

- [ ] **Step 3: Create `apps/web/lib/active-org.ts`**

```ts
export const ACTIVE_ORG_COOKIE = 'valor_active_org';

/** Pure: a raw cookie value, or the env default when absent/empty. */
export function readActiveOrgCookie(value: string | undefined): string {
  return value && value.length > 0 ? value : (process.env.NEXT_PUBLIC_SUPABASE_ORG_ID as string);
}

/** Client: resolve the active org from `document.cookie`, else the env default. */
export function resolveActiveOrgClient(): string {
  const raw = typeof document !== 'undefined'
    ? document.cookie.split('; ').find((c) => c.startsWith(`${ACTIVE_ORG_COOKIE}=`))
    : undefined;
  const value = raw ? decodeURIComponent(raw.slice(ACTIVE_ORG_COOKIE.length + 1)) : undefined;
  return readActiveOrgCookie(value);
}

/** Client: persist the active-org choice. Not httpOnly (the client reads it; RLS enforces access). */
export function writeActiveOrgCookie(orgId: string): void {
  document.cookie = `${ACTIVE_ORG_COOKIE}=${encodeURIComponent(orgId)}; path=/; max-age=31536000; samesite=lax`;
}
```

- [ ] **Step 4: Run + typecheck, verify pass** — `corepack pnpm --filter @valor/web test -- active-org` → PASS (4). `corepack pnpm --filter @valor/web typecheck` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/active-org.ts apps/web/__tests__/active-org.test.ts
git commit -m "feat(web): active-org cookie helpers (resolve/read/write)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Resolve `orgId` from the cookie in both factories

**Files:** Modify `apps/web/lib/repo.ts`, `apps/web/lib/server-repo.ts`. (No new unit test — the configured construction lazy-loads the bundler-only Supabase client and can't run under vitest; the resolution logic is already tested in Task 1. Verified by the existing `repo-factory.test.ts` + typecheck + build, the same rationale H1 used.)

- [ ] **Step 1: Edit `apps/web/lib/repo.ts`.** Add the import near the top (after the existing `@valor/core` import):

```ts
import { resolveActiveOrgClient } from './active-org';
```

Then in `createRepo()`'s configured branch, replace the line `const orgId = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID as string;` with:

```ts
    const orgId = resolveActiveOrgClient();
```

(Leave the `require('./supabase/browser')` + `new SupabaseRepository(createSupabaseBrowserClient(), orgId)` lines and the surrounding comments intact.)

- [ ] **Step 2: Edit `apps/web/lib/server-repo.ts`.** Add the import at the top:

```ts
import { ACTIVE_ORG_COOKIE, readActiveOrgCookie } from './active-org';
```

Then in `getServerRepo()`'s configured branch, replace `const orgId = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID as string;` with the cookie read:

```ts
    const { cookies } = await import('next/headers');
    const store = await cookies();
    const orgId = readActiveOrgCookie(store.get(ACTIVE_ORG_COOKIE)?.value);
```

(`server-repo.ts` is server-only — importing `next/headers` here is safe; `createSupabaseServerClient` already awaits `cookies()`.)

- [ ] **Step 3: Verify** — the existing factory-gate test still passes and both still typecheck/build:
  - `corepack pnpm --filter @valor/web test -- repo-factory` → PASS (unchanged — `supabaseConfigured()` and the unconfigured→`MockRepository` paths are untouched).
  - `corepack pnpm --filter @valor/web typecheck` → 0.
  - `corepack pnpm --filter @valor/web build` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/repo.ts apps/web/lib/server-repo.ts
git commit -m "feat(web): resolve repo orgId from the active-org cookie (client + server)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `ActiveOrgProvider` + `useActiveOrg` (TDD)

**Files:** Create `apps/web/components/active-org-provider.tsx`; Test `apps/web/__tests__/active-org-provider.test.tsx`.

- [ ] **Step 1: Write the failing test** — `apps/web/__tests__/active-org-provider.test.tsx`:

```tsx
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { supabaseConfigured, resolveActiveOrgClient, writeActiveOrgCookie } = vi.hoisted(() => ({
  supabaseConfigured: vi.fn(() => true),
  resolveActiveOrgClient: vi.fn(() => 'org-a'),
  writeActiveOrgCookie: vi.fn(),
}));
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));
vi.mock('@/lib/active-org', () => ({
  ACTIVE_ORG_COOKIE: 'valor_active_org',
  resolveActiveOrgClient: () => resolveActiveOrgClient(),
  writeActiveOrgCookie: (id: string) => writeActiveOrgCookie(id),
}));
vi.mock('@/lib/auth', () => ({ signOut: vi.fn() }));

let session: unknown = { user: { id: 'u1' } };
let rows: unknown[] = [];
let queryError: unknown = null;
const select = vi.fn(async () => ({ data: rows, error: queryError }));
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: async () => ({ data: { session } }) },
    from: () => ({ select }),
  }),
}));

import { ActiveOrgProvider, useActiveOrg } from '@/components/active-org-provider';

const reload = vi.fn();
beforeEach(() => {
  supabaseConfigured.mockReturnValue(true);
  resolveActiveOrgClient.mockReturnValue('org-a');
  writeActiveOrgCookie.mockClear();
  reload.mockClear();
  session = { user: { id: 'u1' } };
  rows = [];
  queryError = null;
  Object.defineProperty(window, 'location', { configurable: true, value: { reload } });
});

function Consumer() {
  const ctx = useActiveOrg();
  return <div>active:{ctx?.activeOrgId ?? 'none'} count:{ctx?.orgs.length ?? -1}</div>;
}

it('passes children through in mock mode (unconfigured)', () => {
  supabaseConfigured.mockReturnValue(false);
  render(<ActiveOrgProvider><div>app</div></ActiveOrgProvider>);
  expect(screen.getByText('app')).toBeInTheDocument();
});

it('renders NotProvisioned when the user has no orgs', async () => {
  rows = [];
  render(<ActiveOrgProvider><div>app</div></ActiveOrgProvider>);
  await waitFor(() => expect(screen.getByText(/access not provisioned/i)).toBeInTheDocument());
  expect(screen.queryByText('app')).not.toBeInTheDocument();
});

it('shows the retry state on a memberships query error', async () => {
  queryError = { message: 'network' };
  render(<ActiveOrgProvider><div>app</div></ActiveOrgProvider>);
  await waitFor(() => expect(screen.getByText(/unable to verify access/i)).toBeInTheDocument());
});

it('provides the org context + children when the active org is valid', async () => {
  rows = [{ org_id: 'org-a', orgs: { name: 'Valor (demo)' } }];
  resolveActiveOrgClient.mockReturnValue('org-a');
  render(<ActiveOrgProvider><Consumer /></ActiveOrgProvider>);
  await waitFor(() => expect(screen.getByText(/active:org-a count:1/)).toBeInTheDocument());
  expect(writeActiveOrgCookie).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});

it('heals an invalid active org: sets the default cookie and reloads once', async () => {
  rows = [{ org_id: 'org-b', orgs: { name: 'Org B' } }];
  resolveActiveOrgClient.mockReturnValue('org-a'); // not in [org-b]
  render(<ActiveOrgProvider><Consumer /></ActiveOrgProvider>);
  await waitFor(() => expect(writeActiveOrgCookie).toHaveBeenCalledWith('org-b'));
  expect(reload).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run, verify fail** — `corepack pnpm --filter @valor/web test -- active-org-provider` → FAIL (cannot resolve `@/components/active-org-provider`).

- [ ] **Step 3: Create `apps/web/components/active-org-provider.tsx`**

```tsx
'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabaseConfigured } from '@/lib/supabase/config';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { NotProvisioned } from '@/components/not-provisioned';
import { resolveActiveOrgClient, writeActiveOrgCookie } from '@/lib/active-org';

export interface OrgInfo { id: string; name: string; }
interface ActiveOrgContextValue { orgs: OrgInfo[]; activeOrgId: string; setActiveOrg: (id: string) => void; }

const ActiveOrgContext = createContext<ActiveOrgContextValue | null>(null);
export function useActiveOrg(): ActiveOrgContextValue | null { return useContext(ActiveOrgContext); }

type State =
  | { kind: 'checking' }
  | { kind: 'ok'; orgs: OrgInfo[]; activeOrgId: string }
  | { kind: 'denied' }
  | { kind: 'error' };

// PostgREST embeds a to-one relation as an object, but the typed client can infer
// an array — normalize both.
type MembershipRow = { org_id: string; orgs: { name: string } | { name: string }[] | null };

/**
 * Evolves H1's RequireMembership: fetch the user's memberships (RLS-scoped to their
 * own rows) with org names, gate (0 → NotProvisioned, error → retry), validate the
 * active-org cookie is one of theirs (self-heal + reload if not), and expose the org
 * context. Mock mode passes children through.
 */
export function ActiveOrgProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'checking' });
  const healedRef = useRef(false);

  useEffect(() => {
    if (!supabaseConfigured()) return;
    let active = true;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (active) setState({ kind: 'ok', orgs: [], activeOrgId: '' }); return; } // middleware gates
      const { data, error } = await supabase.from('memberships').select('org_id, orgs(name)');
      if (!active) return;
      if (error) { setState({ kind: 'error' }); return; }
      const orgs: OrgInfo[] = ((data ?? []) as unknown as MembershipRow[])
        .map((r) => {
          const org = Array.isArray(r.orgs) ? r.orgs[0] : r.orgs;
          return { id: r.org_id, name: org?.name ?? r.org_id };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      if (orgs.length === 0) { setState({ kind: 'denied' }); return; }
      const resolved = resolveActiveOrgClient();
      if (orgs.some((o) => o.id === resolved)) {
        setState({ kind: 'ok', orgs, activeOrgId: resolved });
      } else if (!healedRef.current) {
        healedRef.current = true;
        writeActiveOrgCookie(orgs[0].id);
        window.location.reload();
      }
    })();
    return () => { active = false; };
  }, []);

  const setActiveOrg = (id: string) => {
    writeActiveOrgCookie(id);
    window.location.reload();
  };

  if (!supabaseConfigured()) return <>{children}</>;
  if (state.kind === 'checking') return null;
  if (state.kind === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12 text-sm text-muted-foreground">
        Unable to verify access right now &mdash; please retry.
      </main>
    );
  }
  if (state.kind === 'denied') return <NotProvisioned />;
  return (
    <ActiveOrgContext.Provider value={{ orgs: state.orgs, activeOrgId: state.activeOrgId, setActiveOrg }}>
      {children}
    </ActiveOrgContext.Provider>
  );
}
```

- [ ] **Step 4: Run + typecheck, verify pass** — `corepack pnpm --filter @valor/web test -- active-org-provider` → PASS (5). `corepack pnpm --filter @valor/web typecheck` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/active-org-provider.tsx apps/web/__tests__/active-org-provider.test.tsx
git commit -m "feat(web): ActiveOrgProvider — memberships gate + active-org context (evolves RequireMembership)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `OrgSwitcher` (TDD)

**Files:** Create `apps/web/components/org-switcher.tsx`; Test `apps/web/__tests__/org-switcher.test.tsx`.

- [ ] **Step 1: Write the failing test** — `apps/web/__tests__/org-switcher.test.tsx`:

```tsx
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const useActiveOrg = vi.fn();
vi.mock('@/components/active-org-provider', () => ({ useActiveOrg: () => useActiveOrg() }));

import { OrgSwitcher } from '@/components/org-switcher';

beforeEach(() => useActiveOrg.mockReset());

it('renders nothing without context (mock mode)', () => {
  useActiveOrg.mockReturnValue(null);
  const { container } = render(<OrgSwitcher />);
  expect(container).toBeEmptyDOMElement();
});

it('renders a static label for a single org (no dropdown)', () => {
  useActiveOrg.mockReturnValue({ orgs: [{ id: 'org-a', name: 'Valor (demo)' }], activeOrgId: 'org-a', setActiveOrg: vi.fn() });
  render(<OrgSwitcher />);
  expect(screen.getByText('Valor (demo)')).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

it('renders a dropdown for multiple orgs and switches on change', () => {
  const setActiveOrg = vi.fn();
  useActiveOrg.mockReturnValue({ orgs: [{ id: 'org-a', name: 'Org A' }, { id: 'org-b', name: 'Org B' }], activeOrgId: 'org-a', setActiveOrg });
  render(<OrgSwitcher />);
  fireEvent.change(screen.getByRole('combobox', { name: /active organization/i }), { target: { value: 'org-b' } });
  expect(setActiveOrg).toHaveBeenCalledWith('org-b');
});
```

- [ ] **Step 2: Run, verify fail** — `corepack pnpm --filter @valor/web test -- org-switcher` → FAIL (cannot resolve `@/components/org-switcher`).

- [ ] **Step 3: Create `apps/web/components/org-switcher.tsx`** (mirrors `RoleSwitcher`'s markup):

```tsx
'use client';

import { useActiveOrg } from '@/components/active-org-provider';

/** Active-org switcher: a dropdown when the user belongs to >1 org, a static label
 *  when they have exactly one, and nothing in mock mode (no context). */
export function OrgSwitcher() {
  const ctx = useActiveOrg();
  if (!ctx || ctx.orgs.length === 0) return null;

  if (ctx.orgs.length === 1) {
    const only = ctx.orgs[0];
    return (
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground/70">Org</span>
        <span className="font-mono text-[0.6875rem] text-cream">{only.name}</span>
      </div>
    );
  }

  return (
    <label className="mb-6 flex items-center gap-2 px-2">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground/70">Org</span>
      <select
        aria-label="Active organization"
        value={ctx.activeOrgId}
        onChange={(e) => ctx.setActiveOrg(e.target.value)}
        className="flex-1 rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-[0.6875rem] text-cream outline-none transition-colors focus:border-gold/50"
      >
        {ctx.orgs.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 4: Run + typecheck, verify pass** — `corepack pnpm --filter @valor/web test -- org-switcher` → PASS (3). `corepack pnpm --filter @valor/web typecheck` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/org-switcher.tsx apps/web/__tests__/org-switcher.test.tsx
git commit -m "feat(web): OrgSwitcher — dropdown when >1 org, static label when one" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Wire into the layout + app-shell; remove `RequireMembership`

**Files:** Modify `apps/web/app/(hub)/layout.tsx`, `apps/web/components/app-shell.tsx`; Delete `apps/web/components/require-membership.tsx` + `apps/web/__tests__/require-membership.test.tsx`. (No new unit test — `ActiveOrgProvider`/`OrgSwitcher` are unit-tested in Tasks 3/4; the layout (server component) wiring is build-verified, the same way H1 verified its layout wiring.)

- [ ] **Step 1: Edit `apps/web/app/(hub)/layout.tsx`.** Replace the `RequireMembership` import with `ActiveOrgProvider`, and wrap `AppShell` in it. The two changes:

Change the import line `import { RequireMembership } from '@/components/require-membership';` to:

```ts
import { ActiveOrgProvider } from '@/components/active-org-provider';
```

Change the `shell` JSX from:

```tsx
  const shell = (
    <AppShell tree={tree}>
      <RequireMembership>
        <RoleGate>{children}</RoleGate>
      </RequireMembership>
    </AppShell>
  );
```

to (provider wraps the whole shell so NotProvisioned/checking replaces it, and the sidebar switcher can read the context):

```tsx
  const shell = (
    <ActiveOrgProvider>
      <AppShell tree={tree}>
        <RoleGate>{children}</RoleGate>
      </AppShell>
    </ActiveOrgProvider>
  );
```

(Leave the `RoleProvider` wrapper + the `STATIC_EXPORT` `AuthGate` branch unchanged.)

- [ ] **Step 2: Edit `apps/web/components/app-shell.tsx`.** Add the import alongside the `RoleSwitcher` import:

```ts
import { OrgSwitcher } from '@/components/org-switcher';
```

And render it right after `<RoleSwitcher />`:

```tsx
        <RoleSwitcher />
        <OrgSwitcher />
```

- [ ] **Step 3: Delete the superseded files**

```bash
git rm apps/web/components/require-membership.tsx apps/web/__tests__/require-membership.test.tsx
```

- [ ] **Step 4: Confirm nothing else references `RequireMembership`** — `grep -rn "require-membership\|RequireMembership" apps/web` should return no matches (only the now-deleted files would have). If any remain, update them to `ActiveOrgProvider`.

- [ ] **Step 5: Verify**
  - `corepack pnpm --filter @valor/web test` → full suite passes (the `require-membership` test is gone; `active-org*` + `org-switcher` are present).
  - `corepack pnpm --filter @valor/web typecheck` → 0.
  - `corepack pnpm --filter @valor/web build` → exit 0 (the layout + app-shell compile; `OrgSwitcher` renders).

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(hub)/layout.tsx" apps/web/components/app-shell.tsx apps/web/components/require-membership.tsx apps/web/__tests__/require-membership.test.tsx
git commit -m "feat(web): wire ActiveOrgProvider + OrgSwitcher into the hub; remove RequireMembership" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Verify — full suites, both typechecks, both builds

- [ ] **Step 1:** `corepack pnpm --filter @valor/core test` → all pass (unchanged); `corepack pnpm --filter @valor/core typecheck` → 0.
- [ ] **Step 2:** `corepack pnpm --filter @valor/web test` → all pass; `corepack pnpm --filter @valor/web typecheck` → 0.
- [ ] **Step 3:** `corepack pnpm --filter @valor/web build` → exit 0 (middleware present; routes unchanged).
- [ ] **Step 4:** `STATIC_EXPORT=true corepack pnpm --filter @valor/web build` → exit 0; same page count as before H2 (no new route). Clear the env after.
- [ ] **Step 5:** Fix + re-run anything that fails before proceeding.

---

### Task 7: PR

- [ ] **Step 1:** `git push -u origin feat/auth-h2`; `gh pr create` (title "feat: Supabase Auth H2 — active-org context + switcher"). PR body: what changed; that the switcher only appears for multi-org users (seed a second org + membership to see it); mock mode unchanged; both builds green.
- [ ] **Step 2:** Standard dual-bot review loop (Copilot + CodeRabbit); triage + fix; merge once clean.

---

## Self-Review

**1. Spec coverage:** cookie helpers + `orgId = cookie ?? env` (Tasks 1, 2) ✓; `ActiveOrgProvider` evolving `RequireMembership` with memberships fetch, 0→NotProvisioned, error→retry, validate+self-heal+reload-once, context+`useActiveOrg` (Task 3) ✓; `OrgSwitcher` dropdown-when->1 / static-when-1 / nothing-in-mock (Task 4) ✓; layout wraps `AppShell`, switcher in sidebar, `RequireMembership` removed (Task 5) ✓; both builds + mock unchanged (Task 6) ✓; `supabaseConfigured()` untouched ✓; authz via `memberships` only, anon key only ✓.

**2. Placeholder scan:** none — full code in every code step. Tasks 2 and 5 intentionally have no new unit test (documented rationale: bundler-only client construction + server-component layout wiring are build-verified, exactly as H1 did).

**3. Type consistency:** `ACTIVE_ORG_COOKIE`/`readActiveOrgCookie`/`resolveActiveOrgClient`/`writeActiveOrgCookie` match across `active-org.ts`, `repo.ts`, `server-repo.ts`, `active-org-provider.tsx`. `useActiveOrg()` returns `ActiveOrgContextValue | null`; `OrgSwitcher` and the test consume `{ orgs, activeOrgId, setActiveOrg }` consistently. `OrgInfo { id; name }` is the single org shape. The `MembershipRow` normalization handles PostgREST's object-or-array embed without `as any`. `getServerRepo` stays `Promise<Repository>`; `getRepo` stays sync.
