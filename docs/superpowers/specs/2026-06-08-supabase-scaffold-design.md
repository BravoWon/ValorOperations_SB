# Supabase Backend — Scaffold‑Ahead — Design Spec

**Status:** draft for b.jones review · **Date:** 2026-06-08 · **Branch:** `feat/supabase-scaffold`

> **SCAFFOLD, NOT WIRED.** This delivers the backend **code + migrations + RLS + pgTAP**, all behind the
> existing `Repository` seam, with the **mock adapter still the default**. It is **not run/verified** —
> the migrations and RLS pgTAP tests require b.jones's live Supabase project (URL + keys). The verifiable
> surface here is: the adapter **typechecks** against the `Repository` interface, has **mocked-client unit
> tests** for representative methods, the app **builds**, and a **setup README** lists the exact one-time
> steps to make it live. Nothing about the running app changes (mock default).

**Goal:** Have the Supabase layer ready to flip on the moment creds arrive — schema, tenant-isolation
RLS (proven later via pgTAP), a `SupabaseRepository`, and an env-gated factory.

---

## 1. Database (`supabase/`)

- `supabase/migrations/0001_schema.sql` — the canonical model, multi-tenant by `org_id`:
  - **Tenancy:** `orgs`, `memberships(user_id, org_id, role)` (the RLS pivot; `user_id` → `auth.users`).
  - **Condition-state:** `assets`, `pads`, `wells`, `wellbores`, `formations`, `casing_strings`.
  - **Activity-state:** `job_templates`, `template_stage_defs`, `template_field_defs`, `jobs`, `stages`,
    `job_status_history`, `events`, `field_values` (typed-EAV).
  - **Modules/persistence:** `channels`, `vendors`, `contacts`, `afe_lines`, `rig_days`, `well_setups`
    (JSONB payload columns where the front-end stores whole objects today — mirrors the Local DB snapshot
    collections so the two stores are interchangeable).
  - Every table: `id uuid pk default gen_random_uuid()`, `org_id uuid not null references orgs`,
    `created_at timestamptz default now()`, sensible FKs + indexes (esp. `org_id`).
- `supabase/migrations/0002_rls.sql` — **enable RLS on every table** + a uniform tenant-isolation policy:

  ```sql
  alter table public.<t> enable row level security;
  create policy "<t>_tenant" on public.<t> using (
    org_id in (select org_id from public.memberships where user_id = auth.uid())
  ) with check (
    org_id in (select org_id from public.memberships where user_id = auth.uid())
  );
  ```

- `supabase/tests/rls.test.sql` — **pgTAP** proving tenant isolation: seed two orgs + two users; assert a
  user in org A sees only org A rows on a representative table (e.g. `wells`), and **cannot** insert into
  org B. (Run later with `supabase test db` once the project exists.)
- `supabase/README.md` — the one-time **human setup** steps (the only thing needing b.jones): create the
  project, `supabase link`, `supabase db push` (or run the migrations), set the env vars, `supabase test
  db` to prove RLS, then flip the factory by setting the env. Follows the installed
  `supabase` / `supabase-postgres-best-practices` agent skills.

## 2. Adapter + factory (web)

- `apps/web/lib/supabase-repository.ts` — **`SupabaseRepository implements Repository`** (from `@valor/core`)
  using `@supabase/supabase-js`. Read methods query the condition/activity tables and map to the core
  view types; persistence methods (`save*`/`load*`, `exportSnapshot`/`importSnapshot`/`listCollections`/
  `resetLocalDb`) upsert/select the module tables (JSONB payloads) scoped by `org_id`. **Typechecks**
  against the full interface.
- `apps/web/lib/repo.ts` (factory) — **env-gated**: if `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  + `NEXT_PUBLIC_SUPABASE_ORG_ID` (validated as a UUID) are all set, return a `SupabaseRepository`;
  **otherwise the `MockRepository` (default, unchanged)**. So the running app is identical until creds are
  provided. (As shipped — the original draft gated on URL + anon only; the org UUID was added so a non-UUID
  value can't engage a broken Supabase path.)
- `apps/web/.env.example` — documents `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
  `NEXT_PUBLIC_SUPABASE_ORG_ID` (real `.env*` already gitignored). `@supabase/supabase-js` added to
  `apps/web` deps.

## 3. Files

- `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `supabase/tests/rls.test.sql`, `supabase/README.md`.
  (As shipped: `config.toml` is intentionally **omitted** — `supabase init` generates it per the local CLI
  version; committing one here would conflict. See `supabase/README.md`.)
- `apps/web/lib/supabase-repository.ts`, modified `apps/web/lib/repo.ts`, `apps/web/.env.example`,
  `apps/web/package.json` (+`@supabase/supabase-js`).
- Tests: `apps/web/__tests__/supabase-repository.test.ts` — a **mocked `createClient`** verifying
  representative methods build the right `.from(table).select/upsert(...).eq('org_id', …)` calls and map
  results (e.g. `loadChannels`, `saveChannels`, `listWells`). No network.

## 4. Definition of done (for the SCAFFOLD)

- `@valor/web typecheck` 0 (adapter implements the full `Repository`); mocked adapter tests green; `build`
  compiles; mock remains the default (no behavior change). SQL/RLS/pgTAP committed + `README` lists the
  exact creds/steps. PR clearly labeled **scaffold — migrations not run, RLS not yet proven (needs live
  project)**.

## 5. Review

Standard pipeline + dual-bot review with **max adherence**. PR base = `master`. The RLS-pgTAP "proven not
assumed" gate is explicitly **deferred to the live-project step** and called out in the PR.
