# Supabase Auth H3b — Admin Members UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An in-app `/members` page where an org owner/admin manages the active org's members (list · change role · remove · invite an existing user), built on the already-merged H3a `Repository` contract.

**Architecture:** Unify the app's role source — `ActiveOrgProvider` exposes the user's real `activeRole`, and a new `useEffectiveRole()` hook (live = membership role, mock = demo Role Switcher) feeds the *existing* `AppShell` nav + `RoleGate`. The demo `RoleSwitcher` hides when Supabase is configured. The Members surface is a new Administer-plane route → a thin page → a testable `MembersAdmin` client component calling `getRepo()`.

**Tech Stack:** Next 15 App Router, React 19, TypeScript, Vitest + @testing-library/react (jsdom), `@valor/core`, `@valor/web` (pnpm monorepo).

**No backend changes** — H3b is UI over the merged H3a methods (`listOrgMembers`/`inviteMember`/`setMemberRole`/`removeMember`). The migration + pgTAP are untouched.

**Spec:** `docs/superpowers/specs/2026-06-11-supabase-auth-h3b-design.md`

**Commands (run from repo root):**
- `corepack pnpm --filter @valor/web test`
- `corepack pnpm --filter @valor/web typecheck`
- `corepack pnpm --filter @valor/web build`
- `STATIC_EXPORT=true corepack pnpm --filter @valor/web build`

(Run a single test file with `corepack pnpm --filter @valor/web test -- <name>`.)

**Conventions:** no `as any` (use `as unknown as`); stage only each task's files; commit messages end with the trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Follow the existing `vi.hoisted()` + `vi.mock()` test idiom (see `apps/web/__tests__/active-org-provider.test.tsx`).

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/web/components/active-org-provider.tsx` | adds `role` to the memberships fetch; exposes `activeRole` on context | 1 |
| `apps/web/lib/use-effective-role.ts` (new) | one hook: live membership role vs. mock demo role | 2 |
| `apps/web/components/{app-shell,role-gate}.tsx` | consume `useEffectiveRole()` instead of `useRole().role` | 3 |
| `apps/web/components/role-switcher.tsx` | hidden when `supabaseConfigured()` | 3 |
| `apps/web/lib/planes.ts` | `/members` item in the Administer plane | 4 |
| `apps/web/components/members-admin.tsx` (new) | the members admin UI unit (list/role/remove/invite) | 5 |
| `apps/web/app/(hub)/members/page.tsx` (new) | thin route → `<MembersAdmin />` | 6 |

Tests live beside their existing peers in `apps/web/__tests__/`.

---

## Task 1: `ActiveOrgProvider` exposes `activeRole`

**Files:**
- Modify: `apps/web/components/active-org-provider.tsx`
- Test: `apps/web/__tests__/active-org-provider.test.tsx`

Context: the provider currently fetches `select('org_id, orgs(name)')` and exposes `{ orgs, activeOrgId, setActiveOrg }`. We add the membership `role` to the select, carry it on each `OrgInfo`, and expose `activeRole` (the role of the row matching `activeOrgId`, `'viewer'` default). `Role` and the `isRole` guard come from `@/lib/role`.

- [ ] **Step 1: Write the failing tests**

Add a role consumer and two tests to `apps/web/__tests__/active-org-provider.test.tsx`. Place the consumer next to the existing `Consumer`/`Switcher` helpers, and the tests next to the existing ones:

```tsx
function RoleConsumer() {
  const ctx = useActiveOrg();
  return <div>role:{ctx?.activeRole ?? 'none'}</div>;
}

it("exposes the active org's role as activeRole", async () => {
  rows = [{ org_id: 'org-a', role: 'admin', orgs: { name: 'A' } }]; // resolvedOrg defaults to 'org-a'
  render(<ActiveOrgProvider><RoleConsumer /></ActiveOrgProvider>);
  await waitFor(() => expect(screen.getByText('role:admin')).toBeInTheDocument());
});

it('defaults an unexpected role to viewer', async () => {
  rows = [{ org_id: 'org-a', role: 'superuser', orgs: { name: 'A' } }];
  render(<ActiveOrgProvider><RoleConsumer /></ActiveOrgProvider>);
  await waitFor(() => expect(screen.getByText('role:viewer')).toBeInTheDocument());
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `corepack pnpm --filter @valor/web test -- active-org-provider`
Expected: FAIL — `activeRole` is `undefined` (renders `role:none`), and a TypeScript error that `ActiveOrgContextValue` has no `activeRole`.

- [ ] **Step 3: Implement**

In `apps/web/components/active-org-provider.tsx`:

Add the role import near the top (after the existing imports):

```tsx
import { isRole, type Role } from '@/lib/role';
```

Change `OrgInfo` and the context value:

```tsx
export interface OrgInfo { id: string; name: string; role: Role; }
interface ActiveOrgContextValue { orgs: OrgInfo[]; activeOrgId: string; activeRole: Role; setActiveOrg: (id: string) => void; }
```

Add `activeRole` to the `ok` state variant:

```tsx
type State =
  | { kind: 'checking' }
  | { kind: 'ok'; orgs: OrgInfo[]; activeOrgId: string; activeRole: Role }
  | { kind: 'denied' }
  | { kind: 'error' };
```

Add `role` to the row type:

```tsx
type MembershipRow = { org_id: string; role: string; orgs: { name: string } | { name: string }[] | null };
```

Add `role` to the select:

```tsx
const { data, error } = await supabase.from('memberships').select('org_id, role, orgs(name)');
```

Carry the role on each mapped org:

```tsx
const orgs: OrgInfo[] = ((data ?? []) as unknown as MembershipRow[])
  .map((r) => {
    const org = Array.isArray(r.orgs) ? r.orgs[0] : r.orgs;
    return { id: r.org_id, name: org?.name ?? r.org_id, role: isRole(r.role) ? r.role : 'viewer' };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
```

Set `activeRole` in BOTH `ok` transitions. The no-session branch:

```tsx
if (!session) { if (active) setState({ kind: 'ok', orgs: [], activeOrgId: '', activeRole: 'viewer' }); return; }
```

The valid-resolved branch:

```tsx
if (orgs.some((o) => o.id === resolved)) {
  setState({ kind: 'ok', orgs, activeOrgId: resolved, activeRole: orgs.find((o) => o.id === resolved)?.role ?? 'viewer' });
  return;
}
```

Pass `activeRole` through the provider value at the bottom:

```tsx
<ActiveOrgContext.Provider value={{ orgs: state.orgs, activeOrgId: state.activeOrgId, activeRole: state.activeRole, setActiveOrg }}>
```

- [ ] **Step 4: Run to verify they pass**

Run: `corepack pnpm --filter @valor/web test -- active-org-provider`
Expected: PASS (all prior tests still green — they don't assert `activeRole`, and a missing `role` maps to `'viewer'`).

- [ ] **Step 5: Typecheck**

Run: `corepack pnpm --filter @valor/web typecheck`
Expected: 0 errors. (`OrgSwitcher` reads only `orgs`/`activeOrgId`/`setActiveOrg`, so the added `role` field doesn't affect it.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/active-org-provider.tsx apps/web/__tests__/active-org-provider.test.tsx
git commit -m "feat(web): expose active-org membership role from ActiveOrgProvider

Adds role to the memberships select and surfaces activeRole on the context
(defaults to viewer), so the effective-role hook can drive live nav/gating.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `useEffectiveRole()` hook

**Files:**
- Create: `apps/web/lib/use-effective-role.ts`
- Test: `apps/web/__tests__/use-effective-role.test.tsx`

Context: a single client hook that returns the demo role in mock mode and the real `activeRole` in live mode. It calls all three source hooks unconditionally (Rules of Hooks) and only branches on the return.

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/use-effective-role.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { supabaseConfigured, useRole, useActiveOrg } = vi.hoisted(() => ({
  supabaseConfigured: vi.fn(() => false),
  useRole: vi.fn(() => ({ role: 'owner', setRole: () => {} })),
  useActiveOrg: vi.fn(() => null as null | { activeRole: string }),
}));
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));
vi.mock('@/components/role-provider', () => ({ useRole: () => useRole() }));
vi.mock('@/components/active-org-provider', () => ({ useActiveOrg: () => useActiveOrg() }));

import { useEffectiveRole } from '@/lib/use-effective-role';

beforeEach(() => {
  supabaseConfigured.mockReturnValue(false);
  useRole.mockReturnValue({ role: 'owner', setRole: () => {} });
  useActiveOrg.mockReturnValue(null);
});

describe('useEffectiveRole', () => {
  it('returns the demo role in mock mode (unconfigured)', () => {
    supabaseConfigured.mockReturnValue(false);
    useRole.mockReturnValue({ role: 'field', setRole: () => {} });
    const { result } = renderHook(() => useEffectiveRole());
    expect(result.current).toBe('field');
  });

  it('returns the active-org membership role in live mode', () => {
    supabaseConfigured.mockReturnValue(true);
    useActiveOrg.mockReturnValue({ activeRole: 'admin' });
    const { result } = renderHook(() => useEffectiveRole());
    expect(result.current).toBe('admin');
  });

  it('falls back to viewer in live mode with no active-org context', () => {
    supabaseConfigured.mockReturnValue(true);
    useActiveOrg.mockReturnValue(null);
    const { result } = renderHook(() => useEffectiveRole());
    expect(result.current).toBe('viewer');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `corepack pnpm --filter @valor/web test -- use-effective-role`
Expected: FAIL — `Cannot find module '@/lib/use-effective-role'`.

- [ ] **Step 3: Implement**

Create `apps/web/lib/use-effective-role.ts`:

```tsx
'use client';

import type { Role } from '@/lib/role';
import { useRole } from '@/components/role-provider';
import { useActiveOrg } from '@/components/active-org-provider';
import { supabaseConfigured } from '@/lib/supabase/config';

/**
 * The current user's EFFECTIVE role. In configured (live) mode it is their real
 * membership role in the active org (least-privilege 'viewer' fallback when the
 * active-org context isn't available); in mock mode it is the demo Role Switcher
 * value. All three source hooks are called unconditionally (Rules of Hooks);
 * only the returned value branches on supabaseConfigured().
 */
export function useEffectiveRole(): Role {
  const { role } = useRole();
  const activeOrg = useActiveOrg();
  if (supabaseConfigured()) return activeOrg?.activeRole ?? 'viewer';
  return role;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `corepack pnpm --filter @valor/web test -- use-effective-role`
Expected: PASS (3/3).

(If `renderHook` is not exported by the installed `@testing-library/react`, render a tiny `function Probe() { return <span>{useEffectiveRole()}</span>; }` and assert on its text instead — same assertions.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/use-effective-role.ts apps/web/__tests__/use-effective-role.test.tsx
git commit -m "feat(web): add useEffectiveRole — live membership role vs mock demo role

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire the hook into nav/gate; hide the switcher when configured

**Files:**
- Modify: `apps/web/components/app-shell.tsx`
- Modify: `apps/web/components/role-gate.tsx`
- Modify: `apps/web/components/role-switcher.tsx`
- Modify: `apps/web/__tests__/app-shell.test.tsx`
- Modify: `apps/web/__tests__/role-gate.test.tsx`
- Create: `apps/web/__tests__/role-switcher.test.tsx`

Context: `AppShell` and `RoleGate` currently read `useRole().role` directly. Re-point them at `useEffectiveRole()` (in mock mode it returns exactly `useRole().role`, so behavior is unchanged there). `RoleSwitcher` becomes a no-op in live mode. The two existing tests mock `@/components/role-provider`; since these components now depend on `useEffectiveRole`, re-point those mocks at `@/lib/use-effective-role`.

- [ ] **Step 1: Update the existing tests (now-failing) + add the switcher test**

In `apps/web/__tests__/role-gate.test.tsx`, replace the role-provider mock line:

```tsx
// remove: vi.mock('@/components/role-provider', () => ({ useRole: () => ({ role: h.role, setRole: () => {} }) }));
vi.mock('@/lib/use-effective-role', () => ({ useEffectiveRole: () => h.role }));
```

In `apps/web/__tests__/app-shell.test.tsx`, replace the role-provider mock block:

```tsx
// remove the vi.mock('@/components/role-provider', ...) block
vi.mock('@/lib/use-effective-role', () => ({ useEffectiveRole: () => h.role }));
```

Create `apps/web/__tests__/role-switcher.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { supabaseConfigured } = vi.hoisted(() => ({ supabaseConfigured: vi.fn(() => false) }));
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));
vi.mock('@/components/role-provider', () => ({ useRole: () => ({ role: 'owner', setRole: () => {} }) }));

import { RoleSwitcher } from '@/components/role-switcher';

beforeEach(() => { supabaseConfigured.mockReturnValue(false); });

describe('RoleSwitcher', () => {
  it('renders the demo role select in mock mode', () => {
    supabaseConfigured.mockReturnValue(false);
    render(<RoleSwitcher />);
    expect(screen.getByLabelText('Demo role')).toBeInTheDocument();
  });

  it('is hidden in live (configured) mode', () => {
    supabaseConfigured.mockReturnValue(true);
    const { container } = render(<RoleSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `corepack pnpm --filter @valor/web test -- "role-gate|app-shell|role-switcher"`
Expected: FAIL — `role-switcher` has no hidden behavior yet (renders the select in live mode); `role-gate`/`app-shell` fail because the components still import `useRole` (the new `useEffectiveRole` mock isn't consumed yet).

- [ ] **Step 3: Implement the three component changes**

`apps/web/components/app-shell.tsx` — swap the role source:

```tsx
// remove: import { useRole } from '@/components/role-provider';
import { useEffectiveRole } from '@/lib/use-effective-role';
```
```tsx
// was: const { role } = useRole();
const role = useEffectiveRole();
```

`apps/web/components/role-gate.tsx` — swap the role source:

```tsx
// remove: import { useRole } from '@/components/role-provider';
import { useEffectiveRole } from '@/lib/use-effective-role';
```
```tsx
// was: const { role } = useRole();
const role = useEffectiveRole();
```

`apps/web/components/role-switcher.tsx` — hide when configured. Add the import and an early return at the top of the component body:

```tsx
import { supabaseConfigured } from '@/lib/supabase/config';
```
```tsx
export function RoleSwitcher() {
  if (supabaseConfigured()) return null; // live mode: your role comes from your membership, not a demo cookie
  const { role, setRole } = useRole();
  // ...unchanged...
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `corepack pnpm --filter @valor/web test -- "role-gate|app-shell|role-switcher"`
Expected: PASS. (`app-shell`/`role-gate` now read the mocked `useEffectiveRole`; `role-switcher` hides in live mode.)

- [ ] **Step 5: Full web suite + typecheck**

Run: `corepack pnpm --filter @valor/web test` then `corepack pnpm --filter @valor/web typecheck`
Expected: all green, 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/app-shell.tsx apps/web/components/role-gate.tsx apps/web/components/role-switcher.tsx apps/web/__tests__/app-shell.test.tsx apps/web/__tests__/role-gate.test.tsx apps/web/__tests__/role-switcher.test.tsx
git commit -m "feat(web): drive nav + RoleGate off the effective role; hide demo switcher when configured

In live mode the user's real membership role now gates nav and direct visits;
the demo Role Switcher is hidden (you can't fake your role against RLS). Mock
mode is unchanged (effective role == demo role).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `/members` route in the Administer plane

**Files:**
- Modify: `apps/web/lib/planes.ts`
- Test: `apps/web/__tests__/planes.test.ts`

Context: add a `Members` item (`minRole: 'admin'`) to the existing `administer` plane. `planes.test.ts` enforces an exact route manifest (`EXISTING_NAV`) — `/members` must be added there too, or the length assertions fail.

- [ ] **Step 1: Update the test (failing)**

In `apps/web/__tests__/planes.test.ts`, add `'/members'` to the Administer line of `EXISTING_NAV`:

```ts
'/data-manager', '/template-builder', '/bank-editor', '/office-ops', '/data-studio', '/local-db', '/members',
```

Add a focused test:

```ts
it('exposes the admin-only Members route in the Administer plane', () => {
  const administer = PLANES.find((p) => p.id === 'administer');
  const members = administer?.items.find((i) => i.href === '/members');
  expect(members).toBeDefined();
  expect(members?.minRole).toBe('admin');
  expect(minRoleForPath('/members')).toBe('admin');
  expect(planesForRole('admin').flatMap((p) => p.items.map((i) => i.href))).toContain('/members');
  expect(planesForRole('viewer').flatMap((p) => p.items.map((i) => i.href))).not.toContain('/members');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `corepack pnpm --filter @valor/web test -- planes`
Expected: FAIL — `/members` is in `EXISTING_NAV` but not in `PLANES` (the `toHaveLength(1)` / total-count assertions fail), and the new test fails (`members` undefined).

- [ ] **Step 3: Implement**

In `apps/web/lib/planes.ts`, add `Users` to the `lucide-react` import:

```tsx
import {
  LayoutDashboard, Activity, Clock, Layers, Gauge, Compass,
  Database, Building2, BarChart3, HardDrive, Tags, LayoutTemplate,
  HardHat, Eye, SlidersHorizontal, Server, ClipboardList, CalendarClock, FileText, Users,
} from 'lucide-react';
```

Add the item as the first entry of the `administer` plane's `items`:

```tsx
{
  id: 'administer', label: 'Administer', icon: SlidersHorizontal,
  items: [
    { href: '/members', label: 'Members', icon: Users, minRole: 'admin' },
    { href: '/data-manager', label: 'Data Manager', icon: Database, minRole: 'admin' },
    { href: '/template-builder', label: 'Template Builder', icon: LayoutTemplate, minRole: 'admin' },
    { href: '/bank-editor', label: 'Bank Editor', icon: Tags, minRole: 'admin' },
    { href: '/office-ops', label: 'Office Ops', icon: Building2, minRole: 'admin' },
  ],
},
```

- [ ] **Step 4: Run to verify it passes**

Run: `corepack pnpm --filter @valor/web test -- planes`
Expected: PASS — `/members` is now in exactly one plane, counts line up, and the new admin-gating assertions hold.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/planes.ts apps/web/__tests__/planes.test.ts
git commit -m "feat(web): add the admin-only Members route to the Administer plane

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `MembersAdmin` component

**Files:**
- Create: `apps/web/components/members-admin.tsx`
- Test: `apps/web/__tests__/members-admin.test.tsx`

Context: the testable unit. Loads members via `getRepo().listOrgMembers(orgId)` (orgId = active org, or `DEMO_ORG_ID` in mock), renders a table (email · role `<select>` · Remove) plus an invite form, and re-fetches after each successful mutation. Own-row actions are allowed (no special-casing). Errors are surfaced inline; nothing throws to an error boundary. UI primitives (`PageHeader`, `Card*`, `LoadingState`) are the same ones `office-ops/page.tsx` uses.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/__tests__/members-admin.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { listOrgMembers, setMemberRole, removeMember, inviteMember } = vi.hoisted(() => ({
  listOrgMembers: vi.fn(),
  setMemberRole: vi.fn(),
  removeMember: vi.fn(),
  inviteMember: vi.fn(),
}));
vi.mock('@/lib/repo', () => ({
  DEMO_ORG_ID: 'org-demo',
  getRepo: () => ({ listOrgMembers, setMemberRole, removeMember, inviteMember }),
}));
vi.mock('@/components/active-org-provider', () => ({ useActiveOrg: () => null }));

import { MembersAdmin } from '@/components/members-admin';

const SEED = [
  { userId: 'u-owner', email: 'owner@valor.demo', role: 'owner', createdAt: '2099-01-01T00:00:00.000Z' },
  { userId: 'u-viewer', email: 'viewer@valor.demo', role: 'viewer', createdAt: '2099-01-01T00:00:00.000Z' },
];

beforeEach(() => {
  listOrgMembers.mockReset().mockResolvedValue(SEED);
  setMemberRole.mockReset().mockResolvedValue(undefined);
  removeMember.mockReset().mockResolvedValue(undefined);
  inviteMember.mockReset().mockResolvedValue('added');
});

describe('MembersAdmin', () => {
  it('lists members on mount, scoped to DEMO_ORG_ID in mock mode', async () => {
    render(<MembersAdmin />);
    await waitFor(() => expect(screen.getByText('owner@valor.demo')).toBeInTheDocument());
    expect(screen.getByText('viewer@valor.demo')).toBeInTheDocument();
    expect(listOrgMembers).toHaveBeenCalledWith('org-demo');
  });

  it('changes a role and refetches', async () => {
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('viewer@valor.demo'));
    fireEvent.change(screen.getByLabelText('Role for viewer@valor.demo'), { target: { value: 'admin' } });
    await waitFor(() => expect(setMemberRole).toHaveBeenCalledWith('org-demo', 'u-viewer', 'admin'));
    await waitFor(() => expect(listOrgMembers).toHaveBeenCalledTimes(2)); // mount + refetch
  });

  it('removes a member and refetches', async () => {
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('viewer@valor.demo'));
    fireEvent.click(screen.getByLabelText('Remove viewer@valor.demo'));
    await waitFor(() => expect(removeMember).toHaveBeenCalledWith('org-demo', 'u-viewer'));
  });

  it('does not special-case the own/owner row (actions enabled)', async () => {
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('owner@valor.demo'));
    expect(screen.getByLabelText('Role for owner@valor.demo')).not.toBeDisabled();
    expect(screen.getByLabelText('Remove owner@valor.demo')).not.toBeDisabled();
  });

  it('surfaces the last-owner guard inline (no unhandled throw)', async () => {
    removeMember.mockRejectedValue(new Error('cannot remove the last owner'));
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('owner@valor.demo'));
    fireEvent.click(screen.getByLabelText('Remove owner@valor.demo'));
    await waitFor(() => expect(screen.getByText(/at least one owner/i)).toBeInTheDocument());
  });

  it('invites an existing user (added), clears the field, and refetches', async () => {
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('owner@valor.demo'));
    fireEvent.change(screen.getByLabelText('Invite email'), { target: { value: 'new@valor.demo' } });
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    await waitFor(() => expect(inviteMember).toHaveBeenCalledWith('org-demo', 'new@valor.demo', 'viewer'));
    await waitFor(() => expect(screen.getByText(/added new@valor.demo/i)).toBeInTheDocument());
  });

  it('messages already_member', async () => {
    inviteMember.mockResolvedValue('already_member');
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('owner@valor.demo'));
    fireEvent.change(screen.getByLabelText('Invite email'), { target: { value: 'owner@valor.demo' } });
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    await waitFor(() => expect(screen.getByText(/already a member/i)).toBeInTheDocument());
  });

  it('messages not_found with sign-in guidance', async () => {
    inviteMember.mockResolvedValue('not_found');
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('owner@valor.demo'));
    fireEvent.change(screen.getByLabelText('Invite email'), { target: { value: 'ghost@valor.demo' } });
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    await waitFor(() => expect(screen.getByText(/sign in once via Microsoft/i)).toBeInTheDocument());
  });

  it('shows a retry affordance when the initial load fails', async () => {
    listOrgMembers.mockReset().mockRejectedValueOnce(new Error('network')).mockResolvedValue(SEED);
    render(<MembersAdmin />);
    await waitFor(() => expect(screen.getByText(/couldn't load members/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('owner@valor.demo')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `corepack pnpm --filter @valor/web test -- members-admin`
Expected: FAIL — `Cannot find module '@/components/members-admin'`.

- [ ] **Step 3: Implement**

Create `apps/web/components/members-admin.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import type { OrgMember } from '@valor/core';
import { ALL_ROLES, type Role } from '@/lib/role';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { useActiveOrg } from '@/components/active-org-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/states';

const SELECT_CLASS =
  'rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-wider text-cream outline-none transition-colors focus:border-gold/50';

function lastOwnerGuard(err: unknown): boolean {
  return err instanceof Error && /last owner/i.test(err.message);
}

export function MembersAdmin() {
  const activeOrg = useActiveOrg();
  const orgId = activeOrg?.activeOrgId ?? DEMO_ORG_ID;

  const [members, setMembers] = useState<OrgMember[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('viewer');
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  async function refresh() {
    try {
      const list = await getRepo().listOrgMembers(orgId);
      setMembers(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    let active = true;
    getRepo().listOrgMembers(orgId)
      .then((list) => { if (active) setMembers(list); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [orgId]);

  async function onChangeRole(userId: string, role: Role) {
    setRowError(null);
    setBusy(true);
    try {
      await getRepo().setMemberRole(orgId, userId, role);
      await refresh();
    } catch (err) {
      setRowError(lastOwnerGuard(err) ? 'An org must keep at least one owner.' : "Couldn't update that member — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(userId: string) {
    setRowError(null);
    setBusy(true);
    try {
      await getRepo().removeMember(orgId, userId);
      await refresh();
    } catch (err) {
      setRowError(lastOwnerGuard(err) ? 'An org must keep at least one owner.' : "Couldn't remove that member — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteMsg(null);
    setBusy(true);
    try {
      const result = await getRepo().inviteMember(orgId, email, inviteRole);
      if (result === 'added') {
        setInviteEmail('');
        setInviteMsg(`Added ${email}.`);
        await refresh();
      } else if (result === 'already_member') {
        setInviteMsg(`${email} is already a member of this org.`);
      } else {
        setInviteMsg(`No Valor account for ${email} yet — they need to sign in once via Microsoft, then invite again.`);
      }
    } catch {
      setInviteMsg("Couldn't send that invite — try again.");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <PageHeader
      eyebrow="Administer · Members"
      title="Members"
      subtitle="Manage who can access this organization — change roles, remove members, or invite an existing Valor user."
    />
  );

  if (members === null && loadError) {
    return (
      <div>
        {header}
        <Card><CardContent>
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load members.{' '}
            <button type="button" onClick={refresh} className="text-gold-light underline underline-offset-2">Retry</button>
          </p>
        </CardContent></Card>
      </div>
    );
  }

  if (members === null) {
    return <div>{header}<LoadingState /></div>;
  }

  return (
    <div>
      {header}
      {rowError && <p role="alert" className="mb-4 text-sm text-red-300">{rowError}</p>}
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Members</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 font-medium">Email</th>
                  <th className="py-2 font-medium">Role</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-t border-white/[0.06]">
                    <td className="py-2 text-cream">{m.email}</td>
                    <td className="py-2">
                      <select
                        aria-label={`Role for ${m.email}`}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => onChangeRole(m.userId, e.target.value as Role)}
                        className={SELECT_CLASS}
                      >
                        {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        aria-label={`Remove ${m.email}`}
                        disabled={busy}
                        onClick={() => onRemove(m.userId)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-400/30 bg-red-400/[0.06] px-2 py-1 font-mono text-[0.625rem] uppercase tracking-wider text-red-200 transition-colors hover:bg-red-400/[0.12] disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Invite a member</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onInvite} className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">Email</span>
                <input
                  type="email"
                  required
                  aria-label="Invite email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 text-sm text-cream outline-none transition-colors focus:border-gold/50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">Role</span>
                <select
                  aria-label="Invite role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className={SELECT_CLASS}
                >
                  {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40"
              >
                <UserPlus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Invite
              </button>
            </form>
            {inviteMsg && <p role="status" className="mt-3 text-sm text-muted-foreground">{inviteMsg}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `corepack pnpm --filter @valor/web test -- members-admin`
Expected: PASS (9/9). If clicking the submit button does not dispatch the form's `onSubmit` in this jsdom version, change the three invite tests to `fireEvent.submit(screen.getByLabelText('Invite email').closest('form')!)` after setting the email — same assertions.

- [ ] **Step 5: Typecheck**

Run: `corepack pnpm --filter @valor/web typecheck`
Expected: 0 errors. (`OrgMember.role` is `Role`, matching the `<select value>`; `e.target.value as Role` is the one cast — the options come from `ALL_ROLES`.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/members-admin.tsx apps/web/__tests__/members-admin.test.tsx
git commit -m "feat(web): MembersAdmin — list, change role, remove, invite (H3a methods)

Own-row actions allowed; last-owner guard + invite not_found/already_member
surfaced inline; re-fetches after each mutation. Scopes to the active org
(DEMO_ORG_ID in mock).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: The `/members` page + full verification

**Files:**
- Create: `apps/web/app/(hub)/members/page.tsx`

Context: a thin client page that renders `MembersAdmin`. It inherits the hub layout (sidebar + `RoleGate`), so direct visits are already gated at `minRole: 'admin'`. No `generateStaticParams` (no dynamic segment) — it exports as a static page; the mock data load runs client-side in `MembersAdmin`'s effect.

- [ ] **Step 1: Implement the page**

Create `apps/web/app/(hub)/members/page.tsx`:

```tsx
'use client';

import { MembersAdmin } from '@/components/members-admin';

export default function MembersPage() {
  return <MembersAdmin />;
}
```

- [ ] **Step 2: Full web test suite**

Run: `corepack pnpm --filter @valor/web test`
Expected: all green (the prior suite plus the new `use-effective-role`, `role-switcher`, `members-admin` tests and the updated `active-org-provider`/`planes`/`app-shell`/`role-gate` tests).

- [ ] **Step 3: Typecheck**

Run: `corepack pnpm --filter @valor/web typecheck`
Expected: 0 errors.

- [ ] **Step 4: Normal build**

Run: `corepack pnpm --filter @valor/web build`
Expected: exit 0; `/members` appears in the route output.

- [ ] **Step 5: Static-export build**

Run: `STATIC_EXPORT=true corepack pnpm --filter @valor/web build`
Expected: exit 0 (the `/members` route prerenders — `RoleGate` uses the owner default during prerender, and the member fetch is a client-only effect).

- [ ] **Step 6: Commit**

```bash
git add "apps/web/app/(hub)/members/page.tsx"
git commit -m "feat(web): add the /members route rendering MembersAdmin

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (against the spec)

**Spec coverage:**
- Effective-role plumbing (`activeRole` on provider, `useEffectiveRole`, `AppShell`/`RoleGate` rewire, `RoleSwitcher` hidden) → Tasks 1–3. ✓
- Members surface (`/members` in Administer; thin page → `MembersAdmin`) → Tasks 4–6. ✓
- Data flow (list/role/remove/invite via `getRepo()`; refetch after mutation; orgId = active org / `DEMO_ORG_ID`) → Task 5. ✓
- Error/status handling (invite `added`/`already_member`/`not_found`; last-owner inline; load retry) → Task 5. ✓
- Mock-mode demo unchanged for non-admins; working demo for admin/owner → Tasks 3–6 (effective role == demo role when unconfigured; switcher visible; seeded members render). ✓
- Both build targets green; no `as any`; no `service_role`; authz via memberships → Tasks 3, 6. ✓
- Non-goals respected (no pending invites/email, no settings area, no backend changes). ✓

**Type consistency:** `Role`/`OrgMember`/`InviteResult` from `@valor/core` (re-exported via `@/lib/role` for `Role`); `ALL_ROLES`/`isRole` from `@/lib/role`; `DEMO_ORG_ID`/`getRepo` from `@/lib/repo`; `useActiveOrg().activeRole` defined in Task 1 and consumed in Task 2; `useEffectiveRole()` defined in Task 2 and consumed in Task 3. Method signatures match the H3a contract (`listOrgMembers(orgId)`, `inviteMember(orgId,email,role)`, `setMemberRole(orgId,userId,role)`, `removeMember(orgId,userId)`).

**Placeholder scan:** none — every code step carries full content.

**Sequencing:** the suite is green after every task (Task 1 keeps prior tests green; Task 3 re-points the two tests it would otherwise break in the same commit; Task 4 updates `EXISTING_NAV` in the same commit).
