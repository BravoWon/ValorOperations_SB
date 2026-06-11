# Supabase Auth — Slice H3a (Provisioning data layer) Design

**Status:** Approved (brainstorm 2026-06-11). Spec for implementation planning.

**One-liner:** The backend + data-layer primitives for member management — a migration with four `SECURITY DEFINER` RPCs (list members with emails, invite an existing user, set a member's role, remove a member), a committed pgTAP test, and the `@valor/core` `Repository` contract implemented in both `MockRepository` and `SupabaseRepository`. **No UI** — that's H3b.

---

## Context

Final auth track, decomposed: **H1** (Microsoft SSO) + **H2** (active-org switcher) are merged; **H3** (in-app member provisioning, replacing out-of-band SQL seeding) is split into **H3a** (this spec — the data layer) and **H3b** (the admin UI + role gating, a later slice).

Backend as built (`supabase/migrations/`):
- `memberships(id, org_id, user_id, role, created_at, unique(user_id, org_id))`; `role` is the app `Role` enum — `check (role in ('owner','admin','ops','field','vendor','viewer'))`.
- `orgs(id, name, slug, created_at)`. Emails live in `auth.users` (RLS-locked; not readable from the browser).
- `is_org_admin(p_org_id)` (`SECURITY DEFINER`, `STABLE`, pinned `search_path`) = the caller has role `owner`|`admin` in the org; `revoke all from public` + `grant execute to authenticated`.
- RLS: `memberships_self_select` (a user reads **only their own** membership rows — so an admin can't list members today); `memberships_admin_insert/update/delete` gated by `is_org_admin`.
- The `@valor/core` `Repository` interface has **no** membership/org methods today; neither `MockRepository` nor `SupabaseRepository` touches memberships.

**Decisions (from brainstorming):**
1. **Invite model:** existing users by email only (no `org_invites` table, no `auth.users` trigger). A user must have signed in via SSO at least once (exist in `auth.users`) to be added.
2. **Permissions:** anyone with `is_org_admin` (owner|admin) can invite / set-role / remove any member, and may assign any of the 6 roles. **Last-owner guard:** never leave the org with zero owners (block removing or demoting the last owner).
3. **Delivery:** H3 split into H3a (data layer, this spec) + H3b (UI). The `SupabaseRepository` `.rpc()` wrappers live in H3a (they're the client side of the migration); H3b is purely the provider role + admin page.

## Migration — `supabase/migrations/0003_provisioning.sql`

Four `language plpgsql security definer` functions in `public`, `set search_path = public` (with fully-qualified `auth.users`), each `revoke all on function … from public;` + `grant execute … to authenticated;`, each first guarding `if not public.is_org_admin(p_org_id) then raise exception '…' using errcode = '42501'; end if;`.

- **`org_members(p_org_id uuid) returns table (user_id uuid, email text, role text, created_at timestamptz)`** — `STABLE`; `select m.user_id, u.email::text, m.role, m.created_at from public.memberships m join auth.users u on u.id = m.user_id where m.org_id = p_org_id order by m.created_at`.
- **`invite_member(p_org_id uuid, p_email text, p_role text) returns text`** — validate `p_role in ('owner','admin','ops','field','vendor','viewer')` (else raise); `select id … from auth.users where lower(email) = lower(p_email) limit 1`; **null → return `'not_found'`**; **already a member → return `'already_member'`**; else `insert into public.memberships (org_id, user_id, role) values (…)` → return `'added'`.
- **`set_member_role(p_org_id uuid, p_user_id uuid, p_role text) returns void`** — validate role; **last-owner guard:** if `p_role <> 'owner'` and the target is currently an `owner` and `(count owners in org) <= 1` → `raise exception 'cannot demote the last owner'`; else `update public.memberships set role = p_role where org_id = p_org_id and user_id = p_user_id`.
- **`remove_member(p_org_id uuid, p_user_id uuid) returns void`** — **last-owner guard:** if the target is the org's only `owner` → raise; else `delete from public.memberships where org_id = p_org_id and user_id = p_user_id`.

## pgTAP — `supabase/tests/provisioning.test.sql`

Committed, run via `supabase test db` at activation (like the existing `rls.test.sql`). Seeds two orgs, users, and memberships, then proves (acting as `authenticated` with the relevant `request.jwt.claim.sub`):
- An org admin's `org_members(A)` returns A's members **with emails**, ordered.
- `invite_member(A, <existing user B-not-in-A's email>, 'viewer')` → `'added'` (membership appears); a second call → `'already_member'`; `invite_member(A, 'nobody@example.com', 'viewer')` → `'not_found'`.
- `set_member_role` changes a role; demoting the **last** owner → raises; `remove_member` of the last owner → raises; `remove_member` of a non-last member → succeeds.
- A **non-admin** (a plain member of A, or a non-member) calling any of the four RPCs → raises `42501`.

## `@valor/core` Repository contract

New types in a new module `packages/core/src/members/types.ts`, exported from `packages/core/src/index.ts`:

```ts
export interface OrgMember { userId: string; email: string; role: Role; createdAt: string }
export type InviteResult = 'added' | 'already_member' | 'not_found';
```

Add to the `Repository` interface (`packages/core/src/repository.ts`):

```ts
listOrgMembers(orgId: string): Promise<OrgMember[]>;
inviteMember(orgId: string, email: string, role: Role): Promise<InviteResult>;
setMemberRole(orgId: string, userId: string, role: Role): Promise<void>;
removeMember(orgId: string, userId: string): Promise<void>;
```

## Implementations

**`MockRepository` (`packages/core/src/mock-repository.ts`).** An in-memory `Map<orgId, OrgMember[]>` seeded under `DEMO_ORG_ID` so the demo renders real data (a few members — an `owner`, an `admin`, a `viewer` — with sample emails + deterministic `userId`s and `createdAt`s). Unknown orgIds return `[]`. Implements:
- `listOrgMembers(orgId)` → the org's members sorted by `createdAt`.
- `inviteMember(orgId, email, role)` → `'already_member'` if an email (case-insensitive) matches an existing member; else push a new member (synthetic `userId`) → `'added'`. (No `'not_found'` path in mock — documented; the mock has no `auth.users` gate.)
- `setMemberRole(orgId, userId, role)` → mutate; **throw `Error('cannot demote the last owner')`** if it would demote the org's only owner.
- `removeMember(orgId, userId)` → splice; **throw `Error('cannot remove the last owner')`** if it would remove the org's only owner.

**`SupabaseRepository` (`apps/web/lib/supabase-repository.ts`).** Thin `.rpc()` wrappers:
- `listOrgMembers(orgId)` → `this.client.rpc('org_members', { p_org_id: orgId })`; map rows → `OrgMember` (`user_id`→`userId`, `created_at`→`createdAt`); on error `this.fail(error, 'listOrgMembers')`.
- `inviteMember(orgId, email, role)` → `this.client.rpc('invite_member', { p_org_id: orgId, p_email: email, p_role: role })`; on error `this.fail`; return `data` as `InviteResult`.
- `setMemberRole` / `removeMember` → `this.client.rpc('set_member_role' | 'remove_member', { … })`; on error `this.fail` (an RPC guard raise surfaces as a thrown `Error`).
(These ignore any per-instance org scoping — they take `orgId` explicitly. They can't run under vitest; covered by typecheck + pgTAP, like the rest of `SupabaseRepository`. If `apps/web/__tests__/supabase-repository.test.ts` mocks the client, add call-shape assertions for the four methods.)

## Error handling

- RPC guard/last-owner raises → a thrown `Error` (via `this.fail` in `SupabaseRepository`, or `throw new Error(...)` in `MockRepository`) for H3b to catch and surface.
- `inviteMember` returns a **status string** (`added`/`already_member`/`not_found`), not an error, so H3b can show the right message — notably the "ask them to sign in once first" case for `not_found`.

## Security

- The four RPCs are `SECURITY DEFINER` but each first checks `is_org_admin(p_org_id)` → a non-admin (or `anon`, whose `auth.uid()` is null) gets `42501`. `revoke all from public` + `grant execute to authenticated` per function. `search_path` pinned; `auth.users` read only inside the definer functions, returning only the caller's own org's member emails. Authorization derives solely from `memberships`. **No `service_role`** anywhere. The pgTAP test asserts the non-admin denial. The migration gets a security review of the definer functions before merge.

## Testing / gates

- `@valor/core`: typecheck 0; new `MockRepository` tests (list, invite `added`/`already_member`, set-role + last-owner-demote throw, remove + last-owner throw) green; full core suite green.
- `@valor/web`: typecheck 0 (the new interface methods compile in `SupabaseRepository`); web suite unchanged; **normal + `STATIC_EXPORT=true` builds both exit 0**.
- pgTAP committed (run at activation).

## Non-goals (H3a)

- **No UI** — the admin members page, nav gating, and the `useActiveOrg()` active-role extension are **H3b**.
- No `org_invites` table / `auth.users` trigger (invite is existing-users-only).
- No first-owner bootstrap (still seeded out-of-band).
- No change to `supabaseConfigured()` or mock-mode app behavior.
