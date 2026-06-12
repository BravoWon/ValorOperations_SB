# Supabase activation runbook (Auth H1–H3b)

How to take the web app from the open **mock demo** to a **live, multi-tenant** Supabase backend: Microsoft/Entra SSO (H1), the active-org switcher (H2), and in-app member administration (H3a RPCs + H3b `/members` UI). All the code is merged; these are the **manual, one-time** steps to make it live. Until they're done, the app runs as the open mock demo (no Supabase env → `MockRepository`, demo `/login`, demo Role Switcher).

**Project ref:** `ekswyggelycioeupgfil` · **Tenant:** `jtech.ai` (single-tenant) · **Demo org A:** `00000000-0000-0000-0000-000000000001`

### Order of operations (the spine)
1. **Part A — Database:** apply the schema + RLS + provisioning RPCs to the live project.
2. **Part B — Azure:** register the Entra app.
3. **Part C — Supabase:** enable the Azure provider + set the redirect allowlist.
4. **Part D — App:** create `apps/web/.env.local`.
5. **Part E — Bootstrap:** sign in once, seed the **first owner** by SQL (one time only).
6. **Thereafter:** the owner manages members **in-app** at `/members` — no more SQL.

Two callback URLs that are easy to confuse:

- **Azure → Supabase:** `https://ekswyggelycioeupgfil.supabase.co/auth/v1/callback` — goes in the **Azure** app registration.
- **Supabase → app:** `https://<your-app-origin>/auth/callback` — goes in **Supabase's** redirect allowlist; the H1 code sends it via `redirectTo` (`origin + NEXT_PUBLIC_BASE_PATH + /auth/callback`).

> CLI note: examples use `supabase …`; prefix with `npx ` if the CLI isn't installed globally. The project must be linked once: `supabase link --project-ref ekswyggelycioeupgfil`.
> Reference: <https://supabase.com/docs/guides/auth/social-login/auth-azure>

---

## Part A — Database (schema + RLS + provisioning RPCs)

The repo ships three migrations and two pgTAP suites; they are **scaffold-ahead** and must be applied to the live project before any sign-in can resolve data:

| File | What it creates |
| --- | --- |
| `supabase/migrations/0001_schema.sql` | tables (orgs, memberships, wells, …) |
| `supabase/migrations/0002_rls.sql` | RLS policies + `is_org_admin()` |
| `supabase/migrations/0003_provisioning.sql` | the admin-gated `SECURITY DEFINER` RPCs (`org_members`, `invite_member`, `set_member_role`, `remove_member`) that the `/members` UI calls |

- [ ] **Reconcile migration history first.** `0001`/`0002` were already applied to the live DB out-of-band during the earlier RLS proof (their objects exist), but may not be recorded in the remote migration history — so a naive `supabase db push` would try to re-create existing objects and fail. Check what the remote believes is applied:
  ```bash
  supabase migration list
  ```
  If `0001`/`0002` are **not** marked applied on the remote (but their tables exist), mark them applied so push only runs `0003` (one `repair` per version — the CLI takes a single version at a time):
  ```bash
  supabase migration repair --status applied 0001
  supabase migration repair --status applied 0002
  ```
- [ ] **Apply `0003` (and any unapplied migration) to the live project:**
  ```bash
  supabase db push
  ```
  (Alternative if you'd rather not touch history: paste `supabase/migrations/0003_provisioning.sql` into **SQL editor** and run it once.)
- [ ] **Sanity-check the RPCs exist + grants are tight** (SQL editor):
  ```sql
  select proname, prosecdef, proacl from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('org_members','invite_member','set_member_role','remove_member');
  -- expect 4 rows, all prosecdef = true (security definer). In proacl, each function
  -- should grant EXECUTE to `authenticated` (an `authenticated=X/...` entry) and NOT to
  -- PUBLIC (no bare `=X/...` entry — the migration revokes EXECUTE from public).
  ```
- [ ] **(Optional, local confidence) run the pgTAP suites** against a local stack — validates the RLS policies + the provisioning RPCs (admin gate, last-owner guard, invite contract) without touching live. This repo intentionally omits `supabase/config.toml` (see `supabase/README.md`), so a fresh clone needs a one-time `supabase init` first:
  ```bash
  supabase init                         # once, only if supabase/config.toml is absent
  supabase start && supabase test db    # runs rls.test.sql + provisioning.test.sql
  ```
- [ ] **Run the advisors** and clear anything flagged: `supabase db advisors` (or MCP `get_advisors`).

---

## Part B — Azure Portal (Entra app registration)

At **portal.azure.com → Microsoft Entra ID → App registrations → New registration**.

- [ ] **Name:** `Valor Operations` (anything).
- [ ] **Supported account types:** **"Accounts in this organizational directory only (jtech.ai only — Single tenant)"**.
- [ ] **Redirect URI:** platform **Web**, value:
  ```
  https://ekswyggelycioeupgfil.supabase.co/auth/v1/callback
  ```
  → **Register**.
- [ ] On the app **Overview**, copy:
  - **Application (client) ID** → paste into Supabase (Part C).
  - **Directory (tenant) ID** → used in the Tenant URL (Part C).
- [ ] **Certificates & secrets → Client secrets → New client secret** → pick an expiry → **Add**.
  - ⚠️ **Copy the `Value` column, NOT `Secret ID`.** The Value is shown only once.
- [ ] **(Recommended, security) Add the optional `xms_edov` claim** so Supabase can distinguish verified vs unverified email domains (guards against impersonation — see the Supabase doc's "Unverified Email Domain" note). Path: **App registration → Token configuration → Add optional claim → Token type: ID → tick `xms_edov` → Add** (accept the prompt to enable the required Microsoft Graph permission). Verify `xms_edov` then appears in the **Token configuration** list.
- [ ] **API permissions:** default `User.Read` (openid/profile/email) is enough — the app requests `scopes: 'email'`. If your tenant enforces it, click **Grant admin consent for jtech.ai**.

---

## Part C — Supabase dashboard (Azure provider + URLs)

**Authentication → Providers → Azure**
(<https://supabase.com/dashboard/project/ekswyggelycioeupgfil/auth/providers>)

- [ ] Toggle **Azure** on.
- [ ] **Application (Client) ID** → paste from Part B.
- [ ] **Secret Value** → paste the client-secret **Value** (not the ID).
- [ ] **Azure Tenant URL** → single-tenant, so only jtech.ai accounts work:
  ```
  https://login.microsoftonline.com/<Directory-tenant-ID>
  ```
  (Blank defaults to `/common`/multi-tenant — don't leave it blank.)
- [ ] **Save.**

**Authentication → URL Configuration**

- [ ] **Site URL** → primary app origin, e.g. `https://operations.valorenp.com`.
- [ ] **Redirect URLs (allowlist)** → add every origin's callback:
  ```
  http://localhost:3000/auth/callback
  https://operations.valorenp.com/auth/callback
  ```
  (Add preview/Vercel origins too. Must match the app's `redirectTo`.)

---

## Part D — Point the app at Supabase

Create **`apps/web/.env.local`** (gitignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ekswyggelycioeupgfil.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
NEXT_PUBLIC_SUPABASE_ORG_ID=00000000-0000-0000-0000-000000000001
```

- [ ] Anon key: **Project Settings → API → Project API keys → `anon` `public`** (or `supabase projects api-keys --project-ref ekswyggelycioeupgfil`). It's the JWT labeled `anon` `public` (starts with `eyJ`). **Never** use the `service_role` key here — if a key is labeled `service_role`, do not use it.
- [ ] `NEXT_PUBLIC_SUPABASE_ORG_ID` is the **fallback/default** org. Once you belong to more than one org, the **active-org cookie** (set by the H2 Org Switcher) overrides it; this value is only used before a choice is made.
- [ ] All three present → the app flips to `SupabaseRepository` + the real auth gate, and the demo Role Switcher is replaced by your real membership role. Missing any → stays the open mock demo.

---

## Part E — Bootstrap the first owner (one time)

RLS denies everything until a `memberships` row exists, and you can't create one until the user exists in `auth.users`. This SQL seed is needed **once**, for the very first owner — after that, all member management happens in-app (next section).

- [ ] Run `corepack pnpm --filter @valor/web dev`, click **Sign in with Microsoft**, sign in as **`b.jones@jtech.ai`**. You'll land on **"Access not provisioned"** — expected; it created your `auth.users` row.
- [ ] Get your `auth.users` id: **Authentication → Users** (copy the UUID for `b.jones@jtech.ai`).
- [ ] Seed the owner membership (SQL editor, or `supabase db query`):
  ```sql
  insert into public.memberships (org_id, user_id, role)
  values ('00000000-0000-0000-0000-000000000001', '<your-auth.users-uuid>', 'owner')
  on conflict (user_id, org_id) do nothing;
  ```
- [ ] Sign out → sign in again → the app loads org A's data (RLS-served), and **Administer → Members** appears in the sidebar.

### Thereafter: manage members in-app (no SQL)

Once you're an owner/admin, use **`/members`** (Administer plane):

- **Invite** an existing Valor user by email + role. ⚠️ Invite works **only for users already in `auth.users`** — i.e. someone who has signed in via Microsoft at least once. Inviting an email that's never signed in returns *"No Valor account for that email yet"*; have them sign in once (they'll hit "Access not provisioned"), then invite them.
- **Change role** / **Remove** a member inline. The last-owner guard (server-side) prevents demoting or removing the final owner.
- All four actions go through the admin-gated RPCs (`is_org_admin` → `42501` for non-admins), so the UI is a convenience over a server-enforced boundary, not the boundary itself.

---

## Part F — Verify

- [ ] **DB:** the 4 provisioning RPCs exist with `prosecdef = true` (Part A check); advisors clean.
- [ ] **Auth:** unauthenticated visit → redirected to `/login`. During sign-in the browser briefly hits `https://ekswyggelycioeupgfil.supabase.co/auth/v1/callback` (DevTools → Network if sign-in fails — a redirect-URI mismatch is the most common Azure misconfig). Sign in with Microsoft → `/auth/callback` → app.
- [ ] **Provisioning gate:** a Microsoft account **without** a membership → `NotProvisioned`; **with** → full app, scoped to its org.
- [ ] **Member admin (H3b):** as owner/admin, `/members` lists members; change a role and it persists; removing/demoting the only owner is blocked with the last-owner message; inviting an existing user adds them; inviting a never-signed-in email shows the sign-in-first guidance.
- [ ] **Role gating:** a `viewer`/`field` member does **not** see the Members nav item and a direct visit to `/members` is blocked.
- [ ] Sign out → back to `/login`.

---

**Gotchas**

- **Migration history:** `0001`/`0002` may already be live from the RLS proof but untracked — reconcile per version (`supabase migration repair --status applied 0001`, then `… 0002`) before `supabase db push`, or apply `0003` directly (Part A). Don't blindly `db push` against existing objects.
- **Provisioning RPCs are admin-gated** (`is_org_admin(p_org_id)`); they `revoke execute from public` + `grant to authenticated`, read `auth.users` only inside the definer body, and never use `service_role`. The last-owner guard is enforced in the DB (concurrency-safe via row locks), so the UI can't be tricked into orphaning an org.
- **Invite = existing users only.** There is no email-sending / pending-invite flow — a person must sign in via Microsoft once (creating their `auth.users` row) before they can be invited. This is by design (H3 decision).
- **Local dev:** Azure rejects `127.0.0.1` as a redirect — use `http://localhost:3000` (already allowlisted), not the IP.
- **Anon key only** in `NEXT_PUBLIC_*`. RLS is the real boundary; the middleware gate + the role-based nav are defense-in-depth.
- **No email/password login** — sign-in is Microsoft SSO only. (A one-off `vep-demo@example.com` user may still exist in **Authentication → Users** from the earlier RLS validation; it isn't used by the app and can be deleted. It is not a repo seed.)
- **Two build targets:** the configured (Vercel) build runs the real auth + role; the `STATIC_EXPORT=true` build runs unconfigured (mock + the client `AuthGate` demo-cookie gate + the demo Role Switcher). They're mutually exclusive by deploy config.
