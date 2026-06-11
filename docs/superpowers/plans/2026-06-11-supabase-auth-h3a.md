# Supabase Auth — Slice H3a (Provisioning data layer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The backend + data-layer primitives for member management — a migration with four `SECURITY DEFINER` RPCs + a pgTAP test, plus the `@valor/core` `Repository` contract implemented in `MockRepository` and `SupabaseRepository`. No UI (that's H3b).

**Architecture:** Four admin-only RPCs (`org_members`, `invite_member`, `set_member_role`, `remove_member`) each guard `is_org_admin(p_org_id)` and enforce a last-owner guard; emails come from `auth.users` (why they're definer functions). The `@valor/core` `Repository` gains four methods; `MockRepository` implements them over an in-memory seed (mirroring the guards), `SupabaseRepository` over thin `.rpc()` wrappers. Migration + pgTAP are scaffold-ahead (committed, run at activation), like the existing `0001`/`0002` + `rls.test.sql`.

**Tech Stack:** Postgres/PL/pgSQL, pgTAP, TypeScript, `@valor/core` (Vitest node), `@valor/web` (Vitest jsdom). Spec: `docs/superpowers/specs/2026-06-11-supabase-auth-h3a-design.md`. Branch: `feat/auth-h3a`.

**Commands (repo root):** `corepack pnpm --filter @valor/core test -- <name>` / `test` / `typecheck`; `corepack pnpm --filter @valor/web test -- <name>` / `test` / `typecheck` / `build`; `STATIC_EXPORT=true corepack pnpm --filter @valor/web build`.

**Constraints:** TDD where runnable (the SQL is scaffold-ahead — can't run, the project isn't activated). Core typecheck 0 + new mock tests green; web typecheck 0; web suite unchanged; normal + `STATIC_EXPORT=true` builds exit 0. No `as any` (use `as unknown as`). Never `service_role`. Authz via `memberships` only. The `SECURITY DEFINER` functions get a security review. End every commit body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

- **Create `supabase/migrations/0003_provisioning.sql`** — the 4 RPCs + grants.
- **Create `supabase/tests/provisioning.test.sql`** — pgTAP proof.
- **Create `packages/core/src/members/types.ts`** — `OrgMember`, `InviteResult`.
- **Modify `packages/core/src/index.ts`** — `export * from './members/types';`
- **Modify `packages/core/src/repository.ts`** — 4 methods on `Repository`.
- **Modify `packages/core/src/mock-repository.ts`** — members map + 4 impls.
- **Create `packages/core/test/mock-repository.members.test.ts`**.
- **Modify `apps/web/lib/supabase-repository.ts`** — 4 `.rpc()` impls.
- **Modify `apps/web/__tests__/supabase-repository.test.ts`** — `.rpc` stub + 4 tests.

---

### Task 1: Migration `0003_provisioning.sql` (scaffold-ahead SQL)

**Files:** Create `supabase/migrations/0003_provisioning.sql`. (No automated run — the project isn't activated; verified by review + the pgTAP in Task 2, run at activation. This is the same scaffold-ahead pattern as `0001`/`0002`.)

- [ ] **Step 1: Create `supabase/migrations/0003_provisioning.sql`**

```sql
-- 0003_provisioning.sql — admin member-management RPCs (Auth H3a).
--
-- SCAFFOLD: committed but NOT run here. Applied at activation (`supabase db push`)
-- and proven via supabase/tests/provisioning.test.sql (`supabase test db`).
--
-- The browser's anon role cannot read auth.users (emails) and memberships RLS
-- (memberships_self_select) hides other members — so org owners/admins manage
-- membership through these four SECURITY DEFINER RPCs. Each FIRST checks
-- is_org_admin(p_org_id) -> 42501, so a non-admin (or anon, whose auth.uid() is
-- null) is denied. EXECUTE is revoked from public and granted only to authenticated.

-- 1. List the org's members (with emails from auth.users). Admin only.
create or replace function public.org_members(p_org_id uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, m.role, m.created_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.org_id = p_org_id
    order by m.created_at;
end;
$$;
revoke all on function public.org_members(uuid) from public;
grant execute on function public.org_members(uuid) to authenticated;

-- 2. Invite an EXISTING user (must have signed in via SSO -> exists in auth.users)
--    to the org by email. Returns 'added' | 'already_member' | 'not_found'.
create or replace function public.invite_member(p_org_id uuid, p_email text, p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'ops', 'field', 'vendor', 'viewer') then
    raise exception 'invalid role: %', p_role using errcode = '22023';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user_id is null then
    return 'not_found';
  end if;
  if exists (select 1 from public.memberships where org_id = p_org_id and user_id = v_user_id) then
    return 'already_member';
  end if;

  insert into public.memberships (org_id, user_id, role) values (p_org_id, v_user_id, p_role);
  return 'added';
end;
$$;
revoke all on function public.invite_member(uuid, text, text) from public;
grant execute on function public.invite_member(uuid, text, text) to authenticated;

-- 3. Change a member's role. Admin only; cannot demote the org's last owner.
create or replace function public.set_member_role(p_org_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'ops', 'field', 'vendor', 'viewer') then
    raise exception 'invalid role: %', p_role using errcode = '22023';
  end if;
  if p_role <> 'owner'
     and exists (select 1 from public.memberships where org_id = p_org_id and user_id = p_user_id and role = 'owner')
     and (select count(*) from public.memberships where org_id = p_org_id and role = 'owner') <= 1 then
    raise exception 'cannot demote the last owner' using errcode = '42501';
  end if;
  update public.memberships set role = p_role where org_id = p_org_id and user_id = p_user_id;
end;
$$;
revoke all on function public.set_member_role(uuid, uuid, text) from public;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;

-- 4. Remove a member. Admin only; cannot remove the org's last owner.
create or replace function public.remove_member(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if exists (select 1 from public.memberships where org_id = p_org_id and user_id = p_user_id and role = 'owner')
     and (select count(*) from public.memberships where org_id = p_org_id and role = 'owner') <= 1 then
    raise exception 'cannot remove the last owner' using errcode = '42501';
  end if;
  delete from public.memberships where org_id = p_org_id and user_id = p_user_id;
end;
$$;
revoke all on function public.remove_member(uuid, uuid) from public;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
```

- [ ] **Step 2: Self-review the security** — each function: `security definer`, `is_org_admin` guard first, `revoke all from public` + `grant execute to authenticated`, `search_path` pinned, `auth.users` fully-qualified, no `service_role`. Confirm.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_provisioning.sql
git commit -m "feat(db): 0003 provisioning RPCs — org_members/invite_member/set_member_role/remove_member (admin-gated, last-owner guard)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: pgTAP test `provisioning.test.sql` (scaffold-ahead)

**Files:** Create `supabase/tests/provisioning.test.sql`. (Run at activation via `supabase test db`; mirrors `supabase/tests/rls.test.sql`.)

- [ ] **Step 1: Create `supabase/tests/provisioning.test.sql`**

```sql
-- provisioning.test.sql — pgTAP proof of the H3a member-management RPCs.
-- SCAFFOLD: run at activation with `supabase test db` once 0001..0003 are applied.

begin;
select plan(10);

-- Seed: three users, two orgs, memberships (A: a1 owner + a2 viewer; B: b1 owner).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin-a@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'viewer-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@example.com');
insert into public.orgs (id, name) values
  ('00000000-0000-0000-0000-00000000a000', 'Org A'),
  ('00000000-0000-0000-0000-00000000b000', 'Org B');
insert into public.memberships (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a2', 'viewer'),
  ('00000000-0000-0000-0000-00000000b000', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- Act as a1 (owner/admin of Org A). RPCs are SECURITY DEFINER; the guard reads auth.uid().
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- 1. org_members(A) returns A's members with emails.
select results_eq(
  $$ select email from public.org_members('00000000-0000-0000-0000-00000000a000'::uuid) order by email $$,
  $$ values ('admin-a@example.com'::text), ('viewer-a@example.com'::text) $$,
  'admin sees org A members with emails'
);

-- 2-4. invite: existing user -> added; repeat -> already_member; unknown -> not_found.
select is(public.invite_member('00000000-0000-0000-0000-00000000a000'::uuid, 'owner-b@example.com', 'viewer'),
          'added', 'invite existing user -> added');
select is(public.invite_member('00000000-0000-0000-0000-00000000a000'::uuid, 'owner-b@example.com', 'viewer'),
          'already_member', 'invite existing member -> already_member');
select is(public.invite_member('00000000-0000-0000-0000-00000000a000'::uuid, 'nobody@example.com', 'viewer'),
          'not_found', 'invite unknown email -> not_found');

-- 5. set_member_role: promote the viewer (a2) to admin.
select lives_ok(
  $$ select public.set_member_role('00000000-0000-0000-0000-00000000a000'::uuid, '00000000-0000-0000-0000-0000000000a2'::uuid, 'admin') $$,
  'admin can set a member role'
);

-- 6-7. last-owner guard: demote/remove the only owner (a1) -> raises.
select throws_ok(
  $$ select public.set_member_role('00000000-0000-0000-0000-00000000a000'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 'viewer') $$,
  '42501', null, 'cannot demote the last owner'
);
select throws_ok(
  $$ select public.remove_member('00000000-0000-0000-0000-00000000a000'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  '42501', null, 'cannot remove the last owner'
);

-- 8. remove a non-owner member (b1, added in step 2) -> succeeds.
select lives_ok(
  $$ select public.remove_member('00000000-0000-0000-0000-00000000a000'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid) $$,
  'admin can remove a non-owner member'
);

-- Act as b1 — owner of B, NOT a member/admin of A: a non-admin against A.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';

-- 9-10. non-admin is denied (42501) on list + invite.
select throws_ok(
  $$ select * from public.org_members('00000000-0000-0000-0000-00000000a000'::uuid) $$,
  '42501', null, 'non-admin cannot list members'
);
select throws_ok(
  $$ select public.invite_member('00000000-0000-0000-0000-00000000a000'::uuid, 'admin-a@example.com', 'viewer') $$,
  '42501', null, 'non-admin cannot invite'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/tests/provisioning.test.sql
git commit -m "test(db): pgTAP for the provisioning RPCs (admin/list/invite/role/remove + last-owner + non-admin denial)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `@valor/core` — types, `Repository` contract, `MockRepository` (TDD)

**Files:** Create `packages/core/src/members/types.ts`; Modify `packages/core/src/index.ts`, `packages/core/src/repository.ts`, `packages/core/src/mock-repository.ts`; Test `packages/core/test/mock-repository.members.test.ts`.

> Note: adding the four methods to the `Repository` interface makes `SupabaseRepository` (web) fail typecheck until Task 4 — expected. This task keeps **core** green; web is finished in Task 4.

- [ ] **Step 1: Write the failing test** — `packages/core/test/mock-repository.members.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEMO_ORG_ID } from '../src/seed';

describe('MockRepository — members', () => {
  it('lists the seeded demo members sorted by createdAt', async () => {
    const members = await new MockRepository().listOrgMembers(DEMO_ORG_ID);
    expect(members.map((m) => m.role)).toEqual(['owner', 'admin', 'viewer']);
    expect(members[0]!.email).toBe('owner@valor.demo');
  });

  it('returns [] for an unknown org', async () => {
    expect(await new MockRepository().listOrgMembers('nope')).toEqual([]);
  });

  it('invite adds a new email and is case-insensitive on the repeat', async () => {
    const repo = new MockRepository();
    expect(await repo.inviteMember(DEMO_ORG_ID, 'new@x.com', 'viewer')).toBe('added');
    expect(await repo.inviteMember(DEMO_ORG_ID, 'NEW@x.com', 'viewer')).toBe('already_member');
    expect((await repo.listOrgMembers(DEMO_ORG_ID)).some((m) => m.email === 'new@x.com')).toBe(true);
  });

  it('setMemberRole changes a role but refuses to demote the last owner', async () => {
    const repo = new MockRepository();
    await repo.setMemberRole(DEMO_ORG_ID, 'demo-viewer', 'admin');
    expect((await repo.listOrgMembers(DEMO_ORG_ID)).find((m) => m.userId === 'demo-viewer')?.role).toBe('admin');
    await expect(repo.setMemberRole(DEMO_ORG_ID, 'demo-owner', 'viewer')).rejects.toThrow(/last owner/);
  });

  it('removeMember deletes a member but refuses to remove the last owner', async () => {
    const repo = new MockRepository();
    await repo.removeMember(DEMO_ORG_ID, 'demo-viewer');
    expect((await repo.listOrgMembers(DEMO_ORG_ID)).some((m) => m.userId === 'demo-viewer')).toBe(false);
    await expect(repo.removeMember(DEMO_ORG_ID, 'demo-owner')).rejects.toThrow(/last owner/);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `corepack pnpm --filter @valor/core test -- mock-repository.members` → FAIL (`listOrgMembers` not a function / module).

- [ ] **Step 3: Create `packages/core/src/members/types.ts`**

```ts
import type { Role } from '../enums';

/** A member of an org, as shown in the admin members view. */
export interface OrgMember {
  userId: string;
  email: string;
  role: Role;
  createdAt: string;
}

/** Result of inviting an existing user by email. */
export type InviteResult = 'added' | 'already_member' | 'not_found';
```

- [ ] **Step 4: Export from `packages/core/src/index.ts`** — add `export * from './members/types';` (alongside the other `export *` lines).

- [ ] **Step 5: Add the contract to `packages/core/src/repository.ts`.** Add the imports (extend the existing `./enums` import to include `Role`, and add the members import):

```ts
import type { JobStatus, Role } from './enums';
import type { OrgMember, InviteResult } from './members/types';
```

And add the four methods inside the `Repository` interface (e.g. at the end, before the closing brace):

```ts
  // --- Org membership / provisioning (H3a) ---
  listOrgMembers(orgId: string): Promise<OrgMember[]>;
  inviteMember(orgId: string, email: string, role: Role): Promise<InviteResult>;
  setMemberRole(orgId: string, userId: string, role: Role): Promise<void>;
  removeMember(orgId: string, userId: string): Promise<void>;
```

- [ ] **Step 6: Implement in `packages/core/src/mock-repository.ts`.** Extend the `./seed` import to include `DEMO_ORG_ID`, add the members import + `Role`:

```ts
import { createSeed, DEMO_ORG_ID, type SeedData } from './seed';
import type { Role } from './enums';
import type { OrgMember, InviteResult } from './members/types';
```

Add a seeded members map as a private field (next to the other `private … = new Map(...)` fields):

```ts
  private members = new Map<string, OrgMember[]>([
    [DEMO_ORG_ID, [
      { userId: 'demo-owner', email: 'owner@valor.demo', role: 'owner', createdAt: '2026-01-01T00:00:00.000Z' },
      { userId: 'demo-admin', email: 'admin@valor.demo', role: 'admin', createdAt: '2026-01-02T00:00:00.000Z' },
      { userId: 'demo-viewer', email: 'viewer@valor.demo', role: 'viewer', createdAt: '2026-01-03T00:00:00.000Z' },
    ]],
  ]);
```

Add the four methods (anywhere in the class body):

```ts
  async listOrgMembers(orgId: string): Promise<OrgMember[]> {
    return [...(this.members.get(orgId) ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async inviteMember(orgId: string, email: string, role: Role): Promise<InviteResult> {
    const list = this.members.get(orgId) ?? [];
    if (list.some((m) => m.email.toLowerCase() === email.toLowerCase())) return 'already_member';
    // Deterministic createdAt (no Date in @valor/core); sorts after the seeds.
    list.push({ userId: `mock-${email.toLowerCase()}`, email, role, createdAt: '2099-01-01T00:00:00.000Z' });
    this.members.set(orgId, list);
    return 'added';
  }

  async setMemberRole(orgId: string, userId: string, role: Role): Promise<void> {
    const list = this.members.get(orgId) ?? [];
    const target = list.find((m) => m.userId === userId);
    if (!target) return;
    if (role !== 'owner' && target.role === 'owner' && list.filter((m) => m.role === 'owner').length <= 1) {
      throw new Error('cannot demote the last owner');
    }
    target.role = role;
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    const list = this.members.get(orgId) ?? [];
    const target = list.find((m) => m.userId === userId);
    if (!target) return;
    if (target.role === 'owner' && list.filter((m) => m.role === 'owner').length <= 1) {
      throw new Error('cannot remove the last owner');
    }
    this.members.set(orgId, list.filter((m) => m.userId !== userId));
  }
```

- [ ] **Step 7: Run + typecheck (core only), verify pass**
  - `corepack pnpm --filter @valor/core test -- mock-repository.members` → PASS (5).
  - `corepack pnpm --filter @valor/core test` → full core suite green.
  - `corepack pnpm --filter @valor/core typecheck` → 0. (Web typecheck is expected to be broken until Task 4 — don't run it here.)

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/members/types.ts packages/core/src/index.ts packages/core/src/repository.ts packages/core/src/mock-repository.ts packages/core/test/mock-repository.members.test.ts
git commit -m "feat(core): Repository member-provisioning contract + MockRepository impl (last-owner guard)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `SupabaseRepository` `.rpc()` impls (TDD)

**Files:** Modify `apps/web/lib/supabase-repository.ts`; Test `apps/web/__tests__/supabase-repository.test.ts`.

- [ ] **Step 1: Extend the test's mock client to record `.rpc`, and write the failing tests.** In `apps/web/__tests__/supabase-repository.test.ts`, inside `makeClient`, add an `rpcCalls` recorder + an `rpc` method on the client, and return `rpcCalls`. Change the `client`/return lines from:

```ts
  const client = { from } as unknown as SupabaseClient;
  return { client, calls, setResult };
```

to:

```ts
  const rpcCalls: { name: string; params: unknown }[] = [];
  const rpc = vi.fn((name: string, params: unknown) => {
    rpcCalls.push({ name, params });
    return Promise.resolve(nextResult);
  });
  const client = { from, rpc } as unknown as SupabaseClient;
  return { client, calls, rpcCalls, setResult };
```

Then add these tests inside the `describe('SupabaseRepository (mocked client)', …)` block:

```ts
  it('listOrgMembers() calls the org_members RPC and maps rows to OrgMember[]', async () => {
    const { client, rpcCalls, setResult } = makeClient();
    setResult({ data: [{ user_id: 'u1', email: 'a@x.com', role: 'owner', created_at: '2026-01-01T00:00:00Z' }], error: null });
    const repo = new SupabaseRepository(client, ORG);
    const out = await repo.listOrgMembers('org-1');
    expect(rpcCalls.at(-1)).toEqual({ name: 'org_members', params: { p_org_id: 'org-1' } });
    expect(out).toEqual([{ userId: 'u1', email: 'a@x.com', role: 'owner', createdAt: '2026-01-01T00:00:00Z' }]);
  });

  it('inviteMember() calls the invite_member RPC and returns the status', async () => {
    const { client, rpcCalls, setResult } = makeClient();
    setResult({ data: 'added', error: null });
    const repo = new SupabaseRepository(client, ORG);
    const res = await repo.inviteMember('org-1', 'New@x.com', 'viewer');
    expect(rpcCalls.at(-1)).toEqual({ name: 'invite_member', params: { p_org_id: 'org-1', p_email: 'New@x.com', p_role: 'viewer' } });
    expect(res).toBe('added');
  });

  it('setMemberRole() and removeMember() call their RPCs', async () => {
    const { client, rpcCalls } = makeClient({ data: null, error: null });
    const repo = new SupabaseRepository(client, ORG);
    await repo.setMemberRole('org-1', 'u2', 'admin');
    expect(rpcCalls.at(-1)).toEqual({ name: 'set_member_role', params: { p_org_id: 'org-1', p_user_id: 'u2', p_role: 'admin' } });
    await repo.removeMember('org-1', 'u2');
    expect(rpcCalls.at(-1)).toEqual({ name: 'remove_member', params: { p_org_id: 'org-1', p_user_id: 'u2' } });
  });

  it('surfaces an RPC error via fail()', async () => {
    const { client } = makeClient({ data: null, error: { message: 'not authorized' } });
    const repo = new SupabaseRepository(client, ORG);
    await expect(repo.listOrgMembers('org-1')).rejects.toThrow(/listOrgMembers/);
  });
```

- [ ] **Step 2: Run, verify fail** — `corepack pnpm --filter @valor/web test -- supabase-repository` → FAIL (`listOrgMembers` not a function).

- [ ] **Step 3: Implement in `apps/web/lib/supabase-repository.ts`.** Extend the existing `@valor/core` type import to include `OrgMember`, `InviteResult`, `Role` (the file already imports many core types). Add the four methods to the class:

```ts
  async listOrgMembers(orgId: string): Promise<OrgMember[]> {
    const { data, error } = await this.client.rpc('org_members', { p_org_id: orgId });
    if (error) this.fail(error, 'listOrgMembers');
    return ((data ?? []) as { user_id: string; email: string; role: Role; created_at: string }[])
      .map((r) => ({ userId: r.user_id, email: r.email, role: r.role, createdAt: r.created_at }));
  }

  async inviteMember(orgId: string, email: string, role: Role): Promise<InviteResult> {
    const { data, error } = await this.client.rpc('invite_member', { p_org_id: orgId, p_email: email, p_role: role });
    if (error) this.fail(error, 'inviteMember');
    return data as InviteResult;
  }

  async setMemberRole(orgId: string, userId: string, role: Role): Promise<void> {
    const { error } = await this.client.rpc('set_member_role', { p_org_id: orgId, p_user_id: userId, p_role: role });
    if (error) this.fail(error, 'setMemberRole');
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    const { error } = await this.client.rpc('remove_member', { p_org_id: orgId, p_user_id: userId });
    if (error) this.fail(error, 'removeMember');
  }
```

(If the `@valor/core` import is `import { … type Role, type OrgMember, type InviteResult } from '@valor/core';` style, add the three names there. Use `as unknown as` only if a cast is unavoidable — not `as any`.)

- [ ] **Step 4: Run + typecheck, verify pass**
  - `corepack pnpm --filter @valor/web test -- supabase-repository` → PASS (existing + 4 new).
  - `corepack pnpm --filter @valor/web typecheck` → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/supabase-repository.ts apps/web/__tests__/supabase-repository.test.ts
git commit -m "feat(web): SupabaseRepository member-provisioning .rpc() wrappers" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Verify — suites, both typechecks, both builds

- [ ] **Step 1:** `corepack pnpm --filter @valor/core test` → all pass; `corepack pnpm --filter @valor/core typecheck` → 0.
- [ ] **Step 2:** `corepack pnpm --filter @valor/web test` → all pass (unchanged + the 4 new repo tests); `corepack pnpm --filter @valor/web typecheck` → 0.
- [ ] **Step 3:** `corepack pnpm --filter @valor/web build` → exit 0.
- [ ] **Step 4:** `STATIC_EXPORT=true corepack pnpm --filter @valor/web build` → exit 0; same page count as before (no new route). Clear the env after.
- [ ] **Step 5:** Fix + re-run anything that fails.

---

### Task 6: PR

- [ ] **Step 1:** `git push -u origin feat/auth-h3a`; `gh pr create` (title "feat: Supabase Auth H3a — provisioning data layer (RPCs + Repository contract)"). PR body: the 4 admin-gated RPCs + last-owner guard; migration + pgTAP are scaffold-ahead (run at activation); `MockRepository` mirrors the guards; **no UI (H3b next)**; both builds green. Flag the `SECURITY DEFINER` functions for security review.
- [ ] **Step 2:** Standard dual-bot review loop (Copilot + CodeRabbit); triage + fix; merge once clean.

---

## Self-Review

**1. Spec coverage:** migration 0003 with the 4 RPCs + grants (Task 1) ✓; pgTAP (Task 2) ✓; `OrgMember`/`InviteResult` types + index export (Task 3) ✓; `Repository` interface methods (Task 3) ✓; `MockRepository` impl + seed + last-owner guard + tests (Task 3) ✓; `SupabaseRepository` `.rpc()` wrappers + tests (Task 4) ✓; both typechecks + both builds (Task 5) ✓; security review flagged (Task 6) ✓; no UI / no `service_role` / authz via memberships ✓.

**2. Placeholder scan:** none — full SQL + TS in every code step. The SQL tasks (1, 2) are intentionally not run (project not activated) — verified by review + the committed pgTAP, the documented scaffold-ahead pattern. Task 3 deliberately runs only the **core** checks (web typecheck is broken by the interface addition until Task 4) — documented.

**3. Type consistency:** `OrgMember { userId; email; role: Role; createdAt }` and `InviteResult = 'added'|'already_member'|'not_found'` defined once (Task 3) and used identically in `MockRepository` (Task 3) and `SupabaseRepository` (Task 4) and both test files. RPC names/params match between the migration (`p_org_id`/`p_email`/`p_role`/`p_user_id`), the pgTAP, and the `.rpc()` calls. The four `Repository` signatures match across the interface and both impls. `DEMO_ORG_ID` (`'org-valor'`) is the mock seed key.
