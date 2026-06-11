# Supabase Auth H3b — Admin Members UI — Design

**Date:** 2026-06-11
**Slice:** H3b (the final code slice of the auth track: H1 SSO → H2 active-org switcher → H3a provisioning data layer → **H3b admin members UI**)
**Status:** Approved design, ready for implementation plan.

## Goal

An in-app page where an org **owner/admin** manages the **active** org's members — see members (email + role), change a member's role, remove a member, and invite an existing user by email — consuming the H3a `Repository` methods. Works as a live admin surface when Supabase is configured, and as a self-contained demo on `MockRepository` when it is not.

## Context (as-built before H3b)

- **`Role`** (`@valor/core`, `packages/core/src/enums.ts`) = `'owner' | 'admin' | 'ops' | 'field' | 'vendor' | 'viewer'`. The **same** type backs both `OrgMember.role` (memberships) and the demo `RoleProvider`. No mapping needed.
- **H3a (merged, PR #32)** added a tested `Repository` contract on **both** `MockRepository` and `SupabaseRepository`:
  - `listOrgMembers(orgId): Promise<OrgMember[]>` — `OrgMember = { userId, email, role: Role, createdAt }`.
  - `inviteMember(orgId, email, role): Promise<'added' | 'already_member' | 'not_found'>` — existing users only; `'not_found'` when the email is not yet in `auth.users`.
  - `setMemberRole(orgId, userId, role): Promise<void>` — throws on a last-owner-demote (message contains `last owner`).
  - `removeMember(orgId, userId): Promise<void>` — throws on removing the last owner (message contains `last owner`).
  - The live RPCs are admin-gated server-side (`is_org_admin(p_org_id)` → `42501`) and last-owner-guarded. `MockRepository` seeds demo members under `DEMO_ORG_ID` and mirrors the last-owner guard (it has no `'not_found'` path — every mock email either matches → `'already_member'` or is treated as `'added'`).
- **Existing role-based IA (demo).** The app already gates nav + page access by role:
  - `lib/role.ts` — `ROLE_RANK`, `roleSatisfies(current, min)`, `ALL_ROLES`, `DEFAULT_ROLE='owner'`, `ROLE_COOKIE='valor_demo_role'`.
  - `lib/planes.ts` — `PLANES` (with an existing **Administer** plane of `minRole:'admin'` items), `planesForRole(role)` (filters items + drops empty planes), `minRoleForPath(pathname)`.
  - `components/role-provider.tsx` — `RoleProvider` seeds `DEFAULT_ROLE`, refines from the `valor_demo_role` cookie; `useRole() → { role, setRole }`.
  - `components/role-switcher.tsx` — demo `<select>` over `ALL_ROLES` that writes the cookie.
  - `components/role-gate.tsx` — `RoleGate` blocks hub content when `roleSatisfies(useRole().role, minRoleForPath(pathname))` is false (renders `RoleBlocked`).
  - `RoleProvider`'s own comments state the demo gate is *"not security (real enforcement is server-side RLS once Supabase auth lands)"* — H3b is when auth lands for the admin surface.
- **H2 active-org.** `components/active-org-provider.tsx` (configured mode only): fetches the user's memberships (RLS-scoped) with org names, gates (`0 → NotProvisioned`, error → retry, self-heals an invalid active-org cookie), and exposes `useActiveOrg() → { orgs, activeOrgId, setActiveOrg } | null`. It currently selects only `org_id, orgs(name)`. In **mock mode it passes children through with no context** (`useActiveOrg()` returns `null`).
- **Provider nesting (`app/(hub)/layout.tsx`), outermost → innermost:**
  `RoleProvider > [AuthGate if STATIC_EXPORT] > ActiveOrgProvider > AppShell > RoleGate > {children}`.
  `RoleProvider` is **outermost**, so it cannot read `useActiveOrg()`. But `AppShell`, `RoleGate`, and `RoleSwitcher` (rendered by `AppShell`) all sit **inside both** providers.
- **Repo factory.** `getRepo()` (browser singleton) returns `MockRepository` unless `supabaseConfigured()` (all of `NEXT_PUBLIC_SUPABASE_{URL,ANON_KEY,ORG_ID}`); the `SupabaseRepository` is constructed scoped to the resolved active-org id and **ignores the `orgId` argument** on its methods (`orgScope` pins `this.orgId`). `MockRepository` **uses** the `orgId` argument to key its in-memory members map. `DEMO_ORG_ID` is exported from `@/lib/repo`.

## Decisions (this slice)

1. **Role source = unify on the real role.** In live (configured) mode the user's **real active-org membership role** drives the existing nav + gate; the demo **Role Switcher is hidden** when configured. Mock mode is unchanged (demo cookie role + switcher).
2. **Route = `/members` in the Administer plane** (`app/(hub)/members/page.tsx`).
3. **Own-row actions = allowed.** An admin may change/remove their own row, bounded only by the server/mock last-owner guard.

## Architecture

### A. Effective-role plumbing (the "unify" mechanism)

Rather than re-nest the layout to feed `ActiveOrgProvider`'s role into `RoleProvider`, introduce a single hook consumed by the components that already sit inside both providers.

- **`ActiveOrgProvider` (modify, `components/active-org-provider.tsx`):**
  - Select `'org_id, role, orgs(name)'` (add `role`).
  - Track the role per membership row; compute `activeRole: Role` = the `role` of the row whose `org_id === activeOrgId` (after the active-org cookie is validated/healed).
  - Extend the context value to `{ orgs, activeOrgId, activeRole, setActiveOrg }`. `MembershipRow` gains `role: string`; map it to `Role` (the column is constrained to the 6 roles by the DB; treat an unexpected value defensively as `'viewer'`).
  - No change to the gating/heal/mock-passthrough behavior.

- **`useEffectiveRole()` (new, `apps/web/lib/use-effective-role.ts`):**
  - Calls `useRole()`, `useActiveOrg()`, and `supabaseConfigured()` **unconditionally** (Rules of Hooks), then returns:
    `supabaseConfigured() ? (useActiveOrg()?.activeRole ?? 'viewer') : useRole().role`.
  - Live → real membership role (least-privilege `'viewer'` fallback if somehow absent); mock → demo cookie role. `'use client'`.

- **`AppShell` (modify):** `const role = useEffectiveRole();` (was `useRole().role`) → `planesForRole(role)`.
- **`RoleGate` (modify):** `const role = useEffectiveRole();` (was `useRole().role`).
- **`RoleSwitcher` (modify):** `if (supabaseConfigured()) return null;` at the top; otherwise unchanged.

**Why this is safe / unchanged in mock mode:** when `supabaseConfigured()` is false, `useEffectiveRole()` returns exactly `useRole().role`, so `AppShell`/`RoleGate` behave byte-for-byte as today. In configured mode `ActiveOrgProvider` holds the subtree back until its membership check is `ok`, so `activeRole` is already resolved on the first hub paint (no owner-flash).

### B. The Members surface

- **`planes.ts` (modify):** add to the **Administer** plane:
  `{ href: '/members', label: 'Members', icon: Users, minRole: 'admin' }` (`Users` from `lucide-react`).
  This makes `planesForRole(effectiveRole)` show the nav item only to owner/admin, and `minRoleForPath('/members')` return `'admin'` so `RoleGate` blocks direct visits — in both modes, off the one effective role.

- **`app/(hub)/members/page.tsx` (new, thin):** `'use client'`; renders `<MembersAdmin />`. No `generateStaticParams` (static route, no params — exports cleanly).

- **`components/members-admin.tsx` (new, the testable unit):** `'use client'`.
  - Org id: `const orgId = useActiveOrg()?.activeOrgId ?? DEMO_ORG_ID;` (live → real org; mock → seeded demo org).
  - State: `members: OrgMember[]`, `loading`, a top-level `error` (load failure), an `inviteStatus` message, and per-row pending/error.
  - On mount: `getRepo().listOrgMembers(orgId)` → sort/display.
  - Table rows: email · role `<select>` (over `ALL_ROLES`) · Remove button. **No self-row special-casing** (own-row actions allowed).
  - Invite form: email `<input type=email>` + role `<select>` + submit.

### C. Data flow

```
mount ─ listOrgMembers(orgId) ─────────────► render table
role <select> change ─ setMemberRole(orgId, userId, role) ─► on success: listOrgMembers ─► re-render
Remove click ───────── removeMember(orgId, userId) ────────► on success: listOrgMembers ─► re-render
Invite submit ──────── inviteMember(orgId, email, role) ───► branch on 'added'|'already_member'|'not_found'
```

After every successful mutation, re-fetch `listOrgMembers(orgId)` (source of truth; no optimistic cache). `getRepo()` is the existing singleton — live calls hit the admin-gated RPCs; mock calls hit the seeded map.

### D. Error / status handling

- **Invite result:**
  - `'added'` → clear the form, show a success note, re-fetch.
  - `'already_member'` → inline info ("Already a member of this org").
  - `'not_found'` → inline guidance: "No Valor account for that email yet — they need to sign in once via Microsoft, then invite again." (Direct consequence of the H3 "invite existing users only" decision; the mock never returns this.)
- **`setMemberRole` / `removeMember` rejections:** catch; if the `Error.message` contains `last owner`, show an inline row message ("An org must keep at least one owner"); otherwise a generic inline failure ("Couldn't update — try again"). The page never throws to an error boundary. On a 42501-style admin failure (shouldn't happen given the gate, but defense in depth) the generic message shows.
- **Load failure** (`listOrgMembers` rejects): a page-level retry affordance.

### E. Mock-mode demo

With no Supabase env: `getRepo()=MockRepository`, `useActiveOrg()=null → orgId=DEMO_ORG_ID`, effective role = the demo Role Switcher value. Owner/admin demo roles see the **Members** nav item and the page renders the seeded demo members; role-change/remove/invite operate on the in-memory map (last-owner guard enforced; invite returns `'added'`/`'already_member'`). The demo is fully exercisable and unchanged for non-admin roles (the item is hidden, the route blocked) — matching every other Administer item.

## Testing (TDD, Vitest/jsdom)

- **`active-org-provider.test.tsx`** — rows include `role`; assert `activeRole` is exposed and equals the active org's row role; mock-mode passthrough unchanged.
- **`use-effective-role.test.tsx`** (new) — configured → returns `activeRole` (and `'viewer'` fallback when null); unconfigured → returns `useRole().role`.
- **`role-switcher`** — hidden (`null`) when `supabaseConfigured()`; renders the `<select>` otherwise.
- **`planes.test.ts`** — Members item present in Administer with `minRole:'admin'`; `minRoleForPath('/members')==='admin'`; visible to owner/admin and hidden for viewer/field/ops via `planesForRole`.
- **`members-admin.test.tsx`** (new) — renders seeded members; role `<select>` change calls `setMemberRole` and re-fetches; Remove calls `removeMember` and re-fetches; invite happy path (`'added'`), `'already_member'`, and `'not_found'` messaging; last-owner rejection shows the inline message (no unhandled throw); own-row actions are enabled. Mock `getRepo` + `useActiveOrg`.
- **Regression:** existing `app-shell.test.tsx` / `role-gate.test.tsx` continue to pass (they run with `supabaseConfigured()` false → `useEffectiveRole` ≡ `useRole().role`); update only if a test asserted on `useRole` internals directly.

## Constraints (carried from prior slices)

- Both build targets green: `next build` **and** `STATIC_EXPORT=true … build` (exit 0).
- Mock mode (no Supabase env) is **byte-for-byte** the prior demo for non-admin roles, and a working members demo for admin/owner.
- `supabaseConfigured()` gate unchanged; authz via `memberships` only; **never** `service_role`; no secret in `NEXT_PUBLIC_*`.
- No `as any` (use `as unknown as` where a cast is unavoidable); follow existing file/style conventions.
- pnpm monorepo, `@valor/web`. Commands: `corepack pnpm --filter @valor/web test|typecheck|build`; `STATIC_EXPORT=true corepack pnpm --filter @valor/web build`.

## Non-goals (YAGNI)

- No pending-invite table or email sending — invite targets existing `auth.users` only (the H3 model).
- No org rename / org-settings area (the route lives directly under Administer, not `/settings/*`).
- No audit log, no optimistic UI beyond post-mutation re-fetch, no pagination/search (member lists are small).
- No new backend — H3b is UI over the merged H3a contract; the migration/pgTAP are untouched.

## File summary

| File | Change |
| --- | --- |
| `apps/web/components/active-org-provider.tsx` | select `role`; expose `activeRole` |
| `apps/web/lib/use-effective-role.ts` | **new** — `useEffectiveRole()` |
| `apps/web/components/app-shell.tsx` | use `useEffectiveRole()` |
| `apps/web/components/role-gate.tsx` | use `useEffectiveRole()` |
| `apps/web/components/role-switcher.tsx` | hide when `supabaseConfigured()` |
| `apps/web/lib/planes.ts` | add Members item to Administer |
| `apps/web/app/(hub)/members/page.tsx` | **new** — thin page → `<MembersAdmin />` |
| `apps/web/components/members-admin.tsx` | **new** — the members admin client unit |
| `apps/web/__tests__/{active-org-provider,use-effective-role,role-switcher,planes,members-admin}.test.tsx` | tests |
