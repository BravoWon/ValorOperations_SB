# Supabase backend (scaffold)

This directory holds the Valor Operations Hub backend **as committed code, not a
running database**. The schema, RLS policies, and pgTAP test ship here so the app
can flip from the in-memory `MockRepository` to Supabase the moment credentials
exist. Until then, **the mock remains the default and the app is unchanged.**

```
supabase/
  migrations/
    0001_schema.sql   # canonical multi-tenant schema (every table: uuid pk, org_id, created_at, FKs, org_id index)
    0002_rls.sql       # enable RLS + tenant-isolation policies on every table
  tests/
    rls.test.sql       # pgTAP: proves tenant isolation (run with `supabase test db`)
  README.md            # this file
```

> **Status:** migrations are **not yet run**; RLS is **not yet proven** — both
> require a live project (below). This is the only part that needs a human.

## What the schema enforces

- **Multi-tenant by `org_id`.** Every table has `org_id uuid not null references
  public.orgs(id)`. A user joins an org via `public.memberships(user_id, org_id, role)`.
- **RLS tenant isolation.** `0002_rls.sql` enables RLS on every table and adds a
  uniform policy: a row is visible/writable iff its `org_id` is one of the
  caller's memberships (`org_id in (select org_id from public.memberships where
  user_id = (select auth.uid()))`). `orgs`/`memberships` get bespoke policies.
- **Memberships are admin-gated, not self-service.** A user can *read* their own
  membership rows, but only an existing owner/admin of an org may create/modify
  its memberships (enforced via the `public.is_org_admin(org_id)` SECURITY
  DEFINER helper). This closes a privilege-escalation hole: a self-write policy
  would let any user add themselves to an arbitrary org and read its data. The
  consequence is that the **first** owner of a new org must be seeded out-of-band
  (SQL editor / service role, which bypass RLS) — see step 4.

## One-time setup (the only human step)

You need the [Supabase CLI](https://supabase.com/docs/guides/cli). Verify commands
with `supabase <group> --help` — flags change between versions.

1. **Create a project** at <https://supabase.com/dashboard> (or `supabase projects create`).

2. **Link this repo to it** (run from the repo root):

   ```bash
   supabase link --project-ref <your-project-ref>
   ```

3. **Apply the migrations** (creates the schema + RLS):

   ```bash
   supabase db push
   ```

   This runs `migrations/0001_schema.sql` then `migrations/0002_rls.sql`.

4. **Seed an org + membership for the demo user.** RLS denies everything until a
   `memberships` row links your auth user to an org. Because membership writes
   are admin-gated, this first row must be created here in the **SQL editor / via
   the service-role key** (both bypass RLS) — an unprivileged user cannot grant
   themselves the first membership. In the SQL editor (or `psql`), after the demo
   user has signed up at least once (so an `auth.users` row exists):

   ```sql
   insert into public.orgs (id, name)
   values ('00000000-0000-0000-0000-000000000001', 'Valor (demo)');

   insert into public.memberships (org_id, user_id, role)
   values (
     '00000000-0000-0000-0000-000000000001',
     '<demo-user-uuid-from-auth.users>',
     'owner'
   );
   ```

   Use that org uuid as `NEXT_PUBLIC_SUPABASE_ORG_ID` in step 6. (You can also
   seed the condition/activity demo data here, mirroring `packages/core/src/seed.ts`.)

5. **Prove RLS isolation** with the committed pgTAP test:

   ```bash
   supabase test db
   ```

   This runs `tests/rls.test.sql` — it should report `plan(4)` all passing:
   user A sees only org A's wells, cannot insert a well into org B, and cannot
   self-add a membership into org B (the privilege-escalation guard).

6. **Point the web app at Supabase.** Copy `apps/web/.env.example` to
   `apps/web/.env.local` and fill in:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-project-settings>
   NEXT_PUBLIC_SUPABASE_ORG_ID=00000000-0000-0000-0000-000000000001
   ```

   (`.env.local` is gitignored — never commit real keys.)

7. **The app auto-switches the data layer.** `apps/web/lib/repo.ts` is env-gated:
   when **all three** of `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   and `NEXT_PUBLIC_SUPABASE_ORG_ID` are set, it constructs a `SupabaseRepository`;
   otherwise it returns the `MockRepository`. `ORG_ID` is required (and has no
   fallback) because `org_id` columns are `uuid` — a non-UUID would break
   PostgREST's filters. No code change needed.

   **But this is not yet end-to-end functional — see Known limitations.**

## Known limitations (scaffold)

This directory is **scaffold-ahead**: the schema/RLS/adapter are committed and
type-checked, but the path is not yet a working backend. Before Supabase actually
serves the app you still need to:

- **Wire Supabase Auth + a per-request SSR client.** The RLS policies are all
  `TO authenticated`. The current `repo.ts` builds a plain `anon`-key client held
  as a module singleton with no session — so every query runs as the **anon** role
  and RLS returns **no rows** (and rejects writes). Production needs Supabase Auth
  (login → a real `auth.users` session) **and** a per-request server client created
  from the request's cookies/headers (e.g. [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side)),
  not a singleton. This is the main remaining build step and is intentionally out
  of scope for the scaffold (it needs the live project + auth UI to verify).
- **Run the migrations + pgTAP** against the live project (steps 3 & 5 above).

## Notes

- **The mock stays the default.** With no Supabase env vars, the app runs exactly
  as before. Removing the vars reverts to the mock.
- **`anon` key only in the browser.** RLS does the enforcement; never put the
  `service_role` key in `NEXT_PUBLIC_*` (it would ship to the client).
- **JSONB module tables** (`channels`, `vendors`, `contacts`, `afe_lines`,
  `rig_days`, `well_setups`, `dashboards`) store whole objects today to match the
  front-end's persistence; a later migration can normalize them.
- **`config.toml`** is intentionally omitted — `supabase init` generates it for
  your project; committing one here would conflict with your local CLI version.
