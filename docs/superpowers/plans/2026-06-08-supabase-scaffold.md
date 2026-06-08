# Supabase Backend Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. **This is a SCAFFOLD** — code-complete, NOT run against a live DB. Verifiable gates = typecheck + mocked adapter tests + build; SQL/RLS/pgTAP are committed files run later with creds.

**Goal:** Supabase schema + RLS + pgTAP + a `SupabaseRepository` + env-gated factory, all behind the `Repository` seam, mock remaining default.

**Spec:** `docs/superpowers/specs/2026-06-08-supabase-scaffold-design.md`

**Reference:** consult the installed agent skills `.agents/skills/supabase` and `.agents/skills/supabase-postgres-best-practices` for migration layout, RLS, and best practices.

**Conventions:** mock stays default; never commit real creds (`.env*` already gitignored); the running app must be unchanged unless Supabase env vars are set.

---

## Task 1: Schema migration

**Files:** Create `supabase/migrations/0001_schema.sql`

- [ ] Define the canonical model, every table with `id uuid primary key default gen_random_uuid()`, `org_id uuid not null references public.orgs(id) on delete cascade`, `created_at timestamptz not null default now()`, plus an index on `org_id`:
  - **Tenancy:** `orgs(id, name)`; `memberships(id, user_id uuid references auth.users, org_id, role text)` with `unique(user_id, org_id)`.
  - **Condition-state:** `assets(name, region)`; `pads(asset_id, name)`; `wells(pad_id, name, api, well_type, status)`; `wellbores(well_id, name, kind, td_ft)`; `formations(wellbore_id, name, top_ft, bottom_ft, sort_order)`; `casing_strings(wellbore_id, role, od_in, id_in, weight_ppf, grade, connection, shoe_md_ft, shoe_tvd_ft, toc_ft, cement_sacks, cement_lead_ppg, cement_tail_ppg, sort_order)`.
  - **Activity-state:** `job_templates(name, job_type)`; `template_stage_defs(template_id, stage_no, name, stage_type, sort_order)`; `template_field_defs(template_id, key, label, data_type, unit, "group", sort_order)`; `jobs(well_id, wellbore_id, template_id, name, job_type, status, afe_number, rig_id, primary_vendor_id, created_by)`; `stages(job_id, stage_no, name, stage_type, status, sort_order)`; `job_status_history(job_id, from_status, to_status, changed_by, changed_at, note)`; `events(job_id, stage_id, kind, detail, at_time)`; `field_values(entity_type, entity_id, field_key, value jsonb)`.
  - **Modules (JSONB payloads, mirroring the Local DB snapshot collections):** `channels(payload jsonb)` (one row per channel) OR `channel_sets(payload jsonb)` — use one row per `ChannelDef` with typed columns where cheap, else a `payload jsonb`; `vendors(payload jsonb)`, `contacts(vendor_id, payload jsonb)`, `afe_lines(payload jsonb)`, `rig_days(rig_day_key text, payload jsonb)`, `well_setups(well_id uuid, payload jsonb)`, `dashboards(owner_id text, payload jsonb)`. (JSONB keeps the scaffold faithful to today's whole-object persistence; a later migration can normalize.)
- [ ] **Step: Commit** `feat(supabase): canonical schema migration`.

## Task 2: RLS migration

**Files:** Create `supabase/migrations/0002_rls.sql`

- [ ] For **every** table above: `alter table public.<t> enable row level security;` and a tenant policy:

```sql
create policy "<t>_tenant_select" on public.<t> for select using (
  org_id in (select org_id from public.memberships where user_id = auth.uid())
);
create policy "<t>_tenant_write" on public.<t> for all using (
  org_id in (select org_id from public.memberships where user_id = auth.uid())
) with check (
  org_id in (select org_id from public.memberships where user_id = auth.uid())
);
```

(For `memberships` itself: users see their own rows — `using (user_id = auth.uid())`. `orgs`: visible if the user is a member.)

- [ ] **Step: Commit** `feat(supabase): RLS tenant-isolation policies`.

## Task 3: pgTAP RLS test

**Files:** Create `supabase/tests/rls.test.sql`

- [ ] A pgTAP script that: creates two orgs + two `auth.users` + memberships; inserts a `well` in each org; sets the JWT/role to user A (`set local role authenticated; set local request.jwt.claim.sub = '<A>'` per the supabase skill's pattern); asserts user A sees exactly org A's wells (`results_eq`) and **cannot** insert a well into org B (`throws_ok`). Wrap in `begin; ... rollback;`. Header `plan(N)` / `select * from finish();`.
- [ ] **Step: Commit** `test(supabase): pgTAP RLS tenant-isolation (run with live project)`.

## Task 4: `SupabaseRepository` + mocked tests

**Files:** Create `apps/web/lib/supabase-repository.ts`, `apps/web/__tests__/supabase-repository.test.ts`; modify `apps/web/package.json` (+`@supabase/supabase-js`)

- [ ] Add the dep: `corepack pnpm --filter @valor/web add @supabase/supabase-js`.
- [ ] **Step 1 (test-first):** mocked-client test — `vi.mock('@supabase/supabase-js')` returning a chainable stub (`from().select().eq()` resolves `{ data, error: null }`; `from().upsert()` resolves `{ error: null }`); assert representative methods:
  - `loadChannels()` → `from('channels').select(...)` scoped by org, maps `data` → `ChannelDef[]`.
  - `saveChannels(x)` → `from('channels').upsert(...)`.
  - `listWells(org)` → `from('wells').select(...).eq('org_id', org)` → `Well[]`.
- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** `SupabaseRepository implements Repository` (from `@valor/core`): constructor takes a `SupabaseClient` + an `orgId`; every method maps to a `.from(table)` query scoped by `org_id`; persistence `save*`/`load*` upsert/select the JSONB-payload module tables; `exportSnapshot`/`importSnapshot`/`listCollections` aggregate the module tables; `resetLocalDb` is a no-op-or-throw with a clear message (local-only concept — document it). Must implement the **full** interface (typecheck).
- [ ] **Step 4:** `corepack pnpm --filter @valor/web test supabase-repository` → PASS; `typecheck` 0.
- [ ] **Step 5: Commit** `feat(web): SupabaseRepository adapter (scaffold) + mocked tests`.

## Task 5: Factory + env + README

**Files:** Modify `apps/web/lib/repo.ts`; create `apps/web/.env.example`, `supabase/README.md`

- [ ] `repo.ts` (factory): if `process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` → construct a `SupabaseRepository` (createClient + a resolved orgId — for the demo, a configured default org); **else** the existing `MockRepository` (unchanged default). Keep `getRepo()` a memoized singleton as today.
- [ ] `apps/web/.env.example` — `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=` with comments.
- [ ] `supabase/README.md` — the one-time human steps: create project · `supabase link` · `supabase db push` · seed an org + membership for the demo user · `supabase test db` (prove RLS) · set `apps/web/.env.local` · the app auto-switches to Supabase. Note the mock stays default until then.
- [ ] **Step:** `corepack pnpm --filter @valor/web build` compiles (mock path, no env) + `typecheck` 0. **Commit** `feat(web): env-gated repo factory (Supabase when configured, mock default) + setup README`.

## Task 6: Verify + ship (scaffold)

- [ ] `@valor/core` test green (unchanged); `@valor/web` test + typecheck green; build compiles with NO Supabase env (mock default path) — prove the running app is unchanged.
- [ ] Push `feat/supabase-scaffold`; open PR (base `master`) **clearly labeled scaffold — migrations not run, RLS pgTAP deferred to the live-project step**; action bots per max-adherence; merge on clean review.

## Self-Review
- **Spec coverage:** schema (§1 ✓ T1), RLS (§1 ✓ T2), pgTAP (§1 ✓ T3), adapter+mock tests (§2 ✓ T4), factory+env+README (§2 ✓ T5), scaffold DoD (§4 ✓ T6).
- **Safety:** mock stays default (factory env-gated); no real creds committed; SQL/pgTAP run later with creds — clearly labeled.
- **No placeholders:** SQL patterns + adapter mapping + test approach are concrete; the schema column lists are specified.
