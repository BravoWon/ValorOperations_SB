# Valor Operations Hub — Design Spec (Phase 1)

**Date:** 2026-06-07
**Status:** Draft for review
**Owner:** b.jones@jtech.ai
**Working dir:** `C:\Users\Deving-1\Desktop\dev\ValorOperations_SB`

---

## 1. Summary

An oilfield **E&P operator operations hub**: set up field jobs, track their execution
across lifecycle phases and numbered stages, and consolidate the surrounding org/asset
structure for organizational visibility. This is the practical operations layer beneath the
existing **VEP (Valor Energy Partners / E&P) "Operational Alpha"** vision, whose thesis is
reducing Non-Productive Time (NPT, ~35%+) and operational risk through data discipline.

Phase 1 delivers the **foundation**: org/asset hierarchy, job setup, execution/stage
tracking, an events/NPT log, minimal file attachments, and auth/roles. Cost/AFE, full
document management, dashboards, EDR/LAS ingestion, and native mobile are later phases
(see §11 Roadmap).

## 2. Goals & Non-Goals

**Goals (Phase 1)**
- Model the asset hierarchy (Field → Pad → Well → Wellbore, with formations + casing).
- Create jobs from reusable, type-specific **templates**.
- Track execution: lifecycle phases (job status) + numbered, per-job **stages**.
- Capture **variable inputs** per job/stage without schema migrations (the `witsidcfg` pattern).
- Capture **events / NPT** against jobs and stages.
- Attach raw files (LAS, reports, tickets) to wells/jobs/stages (minimal).
- Role-based access enforced in the database (RLS).
- A clickable, real web app from day one via a **mock data adapter** (backend deferred).

**Non-Goals (Phase 1)** — documented as roadmap, not built now:
- Cost/AFE math, budgets, field-ticket reconciliation (we only store `afe_number`).
- Full document management (foldering, versioning, search, multi-source ingestion).
- Dashboards beyond a lite KPI strip.
- Automated EDR/WITS/LAS parsing & ingestion (→ `channels`/`readings` later).
- Native mobile app and offline sync.
- Vendor job-assignment scoping (vendor = scoped read-only in Phase 1).
- Realtime collaboration, notifications.

## 3. Users & Scale

Operator office staff **and** field crews; up to hundreds of jobs. Web-first now
(responsive + installable PWA); native Expo app is Phase 4 (shares the same backend +
`packages/core`). Online-only for the MVP.

**Roles** (DB-enforced via RLS):

| Action | owner | admin | ops | field | vendor | viewer |
|---|---|---|---|---|---|---|
| Org settings, members | ✅ | ✅ | — | — | — | — |
| Templates (create/edit) | ✅ | ✅ | ✅ | — | — | — |
| Asset hierarchy (wells/pads…) | ✅ | ✅ | ✅ | — | — | read |
| Jobs (create/configure/delete) | ✅ | ✅ | ✅ | read | scoped read | read |
| Advance lifecycle phase | ✅ | ✅ | ✅ | — | — | — |
| Advance stage status | ✅ | ✅ | ✅ | ✅ | — | — |
| Log events/NPT, enter inputs, upload files | ✅ | ✅ | ✅ | ✅ | on assigned* | — |

\* Vendor assignment scoping is Phase 2; in Phase 1 vendor is scoped read-only.

## 4. Domain grounding (why the model looks like this)

Two real artifacts shaped the model:

- **EDR/WITS PostgreSQL dump** (`172.26.69.100_*.sql`): a `witsidcfg` **channel registry**
  (`witsid, description, units, min, max`) plus ~101 `T####` channel tables, each a series of
  `(timedate, depth, value)`. The set of channels is **not fixed** — it varies by rig/well/tool.
  This is the canonical "inputs vary well-to-well" pattern and is the basis for
  `template_field_defs` (and, later, `channels`/`readings`).
- **VEP wellbore diagram** (`vep_ohio_wellbore_diag_ericZ_book1`): the **VALOR ENERGY
  PARTNERS Lease Free #1** well (Ross County, OH; API 34-141-2-0059) with header data,
  a formations table (Ohio Shale, Trenton, Black River…), and a casing program by string
  (conductor/surface/production: hole dia, OD/ID, weight, grade, connection, cement, target
  WOB/ROP, hazards). This is the basis for `wells`, `wellbores`, `formations`, `casing_strings`,
  and serves as the Phase-1 seed/demo + test fixture.

## 5. Architecture & Stack

- **Web:** Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui (Radix).
- **Backend (later milestone):** Supabase — Postgres, Auth, RLS, Storage. Mutations via
  Next.js **server actions**; types generated from the DB (`supabase gen types typescript`).
  Built using the installed **Supabase Agent Skills** (`supabase`,
  `supabase-postgres-best-practices`).
- **Validation:** Zod schemas in `packages/core`, shared by client and server.
- **Data access — swappable adapter (key decision):** the UI talks only to a
  **repository interface** in `packages/core`. Phase 1 ships an **in-memory/mock adapter**
  (seeded with VEP data) so the entire frontend is real and clickable. The **Supabase adapter**
  (+ migrations + RLS) is the next milestone and drops in **without changing UI code**.
- **Deploy:** Vercel (web) + Supabase Cloud.

**Project structure** (light pnpm monorepo; native app is a drop-in later):
```
ValorOperations_SB/
  apps/
    web/            # Next.js app — Phase 1 deliverable
    mobile/         # Expo/React Native — Phase 4 placeholder (not built now)
  packages/
    core/           # domain types, Zod schemas, repository INTERFACE,
                    #   mock adapter (now), supabase adapter (later), domain logic
  supabase/
    migrations/     # versioned SQL — source of truth for schema (backend milestone)
    seed.sql        # VEP Lease Free #1 demo data
  .agents/skills/   # installed Supabase Agent Skills
  docs/superpowers/specs/
```

## 6. Data Model

Multi-tenant: **every table carries `org_id`**; access enforced via RLS (§9).

**Identity & Org**
- `organizations` — id, name, slug
- `profiles` — id (= auth user), full_name, email, default_org_id
- `org_members` — (org_id, user_id, **role** enum: owner/admin/ops/field/vendor/viewer)

**Asset hierarchy**
- `assets` — org_id, name, basin/region (field/area)
- `pads` — asset_id, name, surface_lat, surface_long
- `wells` — pad_id, name, api_number, permit_number, state, county, township, section,
  surface_lat/long, ground_elev_ft, kb_height_ft, status, spud_date
- `wellbores` — well_id, designation, total_md_ft, total_tvd_ft, type
  (vertical/directional/horizontal)  *(supports sidetracks)*
- `formations` — wellbore_id, name, top_md_ft, bottom_md_ft, lithology, target_zone, sort_order
- `casing_strings` — wellbore_id, string_type (conductor/surface/intermediate/production),
  hole_dia_in, set_md_ft, set_tvd_ft, csg_od_in, csg_id_in, weight_ppf, grade, connection,
  toc_ft, cement_weight_ppg, cement_sacks, cement_excess_pct
- `service_companies` — org_id, name, type (drilling_contractor/service/supply), contacts
- `rigs` — org_id, name, contractor_id → service_companies

**Templates & field registry** *(the flexible spine — `witsidcfg` analog)*
- `job_templates` — org_id, name, job_type (drilling/completion/workover/other), version, is_active
- `template_stage_defs` — template_id, name, stage_type, default_sort_order
- `template_field_defs` — template_id, **scope** (job/stage), key, label,
  **data_type** (number/text/bool/date/enum), **unit, min_value, max_value**,
  enum_options (jsonb), required, sort_order

**Jobs**
- `jobs` — org_id, well_id, wellbore_id?, template_id, name, job_type,
  **status** (planned/mobilized/executing/suspended/complete/closed), afe_number,
  planned_start, planned_end, actual_start, actual_end, rig_id?, primary_vendor_id?, created_by
- `job_status_history` — job_id, from_status, to_status, changed_by, changed_at, note
  *(lifecycle-phase audit trail)*

**Execution tracking**
- `stages` — org_id, job_id, **stage_no**, name, stage_type,
  status (planned/active/done/skipped), planned_start, actual_start, actual_end,
  depth_in_ft, depth_out_ft, notes, sort_order
- `field_values` — **polymorphic**: entity_type (job/stage), entity_id, field_def_id?, key,
  value_num, value_text, value_bool, value_date *(actual inputs keyed to the registry; ad-hoc keys allowed)*
- `events` — org_id, job_id, stage_id?, **event_type** (activity/npt/milestone/hse/note),
  category_code, title, description, start_at, end_at, duration_min (generated), npt_hours, created_by

**Attachments (minimal)**
- `attachments` — org_id, **polymorphic** (entity_type well/wellbore/job/stage, entity_id),
  storage_path, file_name, mime_type, size_bytes, kind (las/report/ticket/photo/other), uploaded_by

**Relationships**
```
org ─< assets ─< pads ─< wells ─< wellbores ─< formations
                                          └─< casing_strings
org ─< job_templates ─< template_stage_defs
                    └─< template_field_defs
org ─< jobs (→ well, → wellbore?, → template, → rig?, → vendor?)
        ├─< stages ─< field_values (stage)
        ├─< field_values (job)
        ├─< events (→ stage?)
        └─< job_status_history
attachments → (well | wellbore | job | stage)
```

**Design calls**
- Flexible inputs via typed-EAV `field_values` (not a JSONB blob) to preserve units, min/max
  validation, and per-field querying — matching `witsidcfg`/`T####`. Dedicated time-series
  `channels`/`readings` are the natural Phase-3 extension of `field_defs`.
- Lifecycle phases = standardized `jobs.status` enum + `job_status_history`; stages =
  template-defined and per-job. (This is the "Both" requirement: macro phases + numbered sub-stages.)

## 7. UX / Information Architecture

- **Shell:** left sidebar with **module nav + a collapsible asset tree** (Field › Pad › Well ›
  Wellbore). Combines the "jobs-first" and "hierarchy-first" mental models.
- **Landing:** **Active Jobs board** — columns by lifecycle phase
  (Planned · Mobilized · Executing · Complete); cards are jobs. A **lite KPI strip** on top
  (active jobs · NPT hrs · executing count) is the Phase-1 slice of the future dashboard.
- **Job detail:** **tabbed record** — persistent header + phase stepper, then tabs:
  **Overview · Stages · Events/NPT · Inputs · Files**. Phone-friendly, scales, one tab at a time.
- **Visual quality:** use the `frontend-design` skill during implementation so the hub is
  polished and distinctive, not generic CRUD.

**Primary flow — create & run a job**
1. Ops creates a job from a **Drilling** template on Lease Free #1.
2. Template **pre-creates stages** (e.g., Conductor / Surface / Production runs) and exposes
   **input fields** (Target WOB/ROP, mud weight, sacks, …) with units + valid ranges.
3. Field crew advances **stage** status, logs **events/NPT**, enters stage **inputs**, uploads files.
4. Ops advances the **lifecycle phase**; on completion, closes the job.

## 8. Validation & Error Handling

- **Zod** validates every server-action input; the same schemas drive client form validation.
- **`field_values` validated against `template_field_defs`:** type coercion + required (hard block)
  and **min/max range** (inline warning with ops override).
- **DB backstop:** FK + check constraints + enums + not-null; RLS denies unauthorized writes
  (surfaced as "not permitted", never a silent no-op).
- **Phase/stage transitions** validated against an allowed-transition map, with `updated_at`
  optimistic-concurrency checks (no clobbering between crews).
- **Online-only:** network failures show a clear retry toast (no offline queue in MVP).

## 9. Security (RLS)

- A SQL helper `is_org_member(org_id, min_role)` backs every policy.
- Reads require org membership for the row's `org_id`; writes additionally check role per §3.
- Tenant isolation: org A cannot read org B — proven by pgTAP tests, not assumed.
- Supabase Storage bucket `attachments` is org-scoped via path + policy.

## 10. Testing Strategy

- **Vitest** — domain logic in `core`: transition rules, field validation/coercion,
  template→stage instantiation, mock adapter.
- **pgTAP** — RLS policy tests (per-role allow/deny + tenant isolation) at the backend milestone.
- **Playwright** — golden path: sign in → create well → create job from template →
  stages auto-populate → advance phase → log NPT → enter inputs → close job.
- **Seed/fixtures** — VEP Lease Free #1 (formations + casing program).

## 11. Implementation Sequencing & Roadmap

**Phase 1 build order (frontend-first):** steps 1–6 produce a **fully clickable app running on
the mock adapter** (real UI, real flows, seeded data) — so the backend (step 7) is genuinely
deferrable and lands behind the repository interface without UI changes.
1. Monorepo + Next.js app shell + `packages/core` skeleton (types, Zod, repository interface).
2. Mock adapter seeded with VEP data.
3. Asset hierarchy UI (tree + well/wellbore/formations/casing views).
4. Templates & field-registry UI.
5. Jobs: create-from-template + Active Jobs board + lite KPI strip.
6. Execution: tabbed job detail (stages, inputs/field_values, events/NPT, files), transition rules.
7. **Backend milestone:** Supabase schema migrations + RLS + Auth + Storage + Supabase adapter
   (swap in behind the repository interface) + generated types + pgTAP.

**Later phases:**
- **P2:** cost/AFE + field tickets · full document management · full dashboards · vendor assignment scoping.
- **P3:** EDR/WITS/LAS ingestion → `channels`/`readings` + analytics.
- **P4:** Expo native app + offline sync.

## 12. Assumptions & Open Questions

- Single operator org to start; multi-org supported by the model but not a Phase-1 focus.
- `afe_number` is a free-text reference in Phase 1 (no cost engine).
- Auth: Supabase email/password + magic link (decided at backend milestone).
- Stage "types" (frac stage / BHA run / casing string) are template-defined strings, not a fixed enum.
