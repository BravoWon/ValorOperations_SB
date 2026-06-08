-- 0001_schema.sql — Valor Operations Hub canonical multi-tenant schema.
--
-- SCAFFOLD: this migration is committed but NOT run against a live database yet.
-- It is applied later via `supabase db push` once the project + creds exist
-- (see supabase/README.md). Mirrors the @valor/core domain model so the
-- Supabase store is interchangeable with the in-memory MockRepository.
--
-- Conventions (every table):
--   id          uuid primary key default gen_random_uuid()
--   org_id      uuid not null references public.orgs(id) on delete cascade
--   created_at  timestamptz not null default now()
--   + an index on org_id (and on every other foreign-key column)
--
-- gen_random_uuid() is provided by the pgcrypto extension, which is preinstalled
-- on Supabase. We create it defensively so the migration is portable.

create extension if not exists "pgcrypto";

-- ============================================================================
-- Tenancy
-- ============================================================================

-- orgs is the tenant root. It has no org_id of its own (it *is* the tenant).
create table public.orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  created_at  timestamptz not null default now()
);

-- memberships is the RLS pivot: it maps an auth.users row to an org + role.
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'viewer'  -- Role (packages/core/src/enums.ts)
                check (role in ('owner', 'admin', 'ops', 'field', 'vendor', 'viewer')),
  created_at  timestamptz not null default now(),
  unique (user_id, org_id)
);
create index memberships_org_id_idx on public.memberships (org_id);
create index memberships_user_id_idx on public.memberships (user_id);

-- ============================================================================
-- Condition-state (the physical world: assets → pads → wells → wellbores → ...)
-- ============================================================================

create table public.assets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  name        text not null,
  region      text,
  created_at  timestamptz not null default now()
);
create index assets_org_id_idx on public.assets (org_id);

create table public.pads (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  asset_id      uuid not null references public.assets(id) on delete cascade,
  name          text not null,
  surface_lat   double precision,
  surface_long  double precision,
  created_at    timestamptz not null default now()
);
create index pads_org_id_idx on public.pads (org_id);
create index pads_asset_id_idx on public.pads (asset_id);

create table public.wells (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  pad_id        uuid not null references public.pads(id) on delete cascade,
  name          text not null,
  api_number    text,
  permit_number text,
  state         text,
  county        text,
  township      text,
  section       text,
  surface_lat   double precision,
  surface_long  double precision,
  ground_elev_ft double precision,
  kb_height_ft  double precision,
  well_type     text,
  status        text,
  spud_date     date,
  created_at    timestamptz not null default now()
);
create index wells_org_id_idx on public.wells (org_id);
create index wells_pad_id_idx on public.wells (pad_id);

create table public.wellbores (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  well_id       uuid not null references public.wells(id) on delete cascade,
  designation   text not null,
  kind          text,                 -- WellboreType: vertical | directional | horizontal
  total_md_ft   double precision,
  total_tvd_ft  double precision,
  created_at    timestamptz not null default now()
);
create index wellbores_org_id_idx on public.wellbores (org_id);
create index wellbores_well_id_idx on public.wellbores (well_id);

create table public.formations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  wellbore_id   uuid not null references public.wellbores(id) on delete cascade,
  name          text not null,
  top_ft        double precision,
  bottom_ft     double precision,
  lithology     text,
  target_zone   boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index formations_org_id_idx on public.formations (org_id);
create index formations_wellbore_id_idx on public.formations (wellbore_id);

create table public.casing_strings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  wellbore_id   uuid not null references public.wellbores(id) on delete cascade,
  role          text not null         -- CasingStringType (required in @valor/core)
                  check (role in ('conductor', 'surface', 'intermediate', 'production')),
  hole_dia_in   double precision,
  od_in         double precision,
  id_in         double precision,
  weight_ppf    double precision,
  grade         text,
  connection    text,
  shoe_md_ft    double precision,
  shoe_tvd_ft   double precision,
  toc_ft        double precision,
  cement_sacks  double precision,
  cement_lead_ppg  double precision,
  cement_tail_ppg  double precision,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index casing_strings_org_id_idx on public.casing_strings (org_id);
create index casing_strings_wellbore_id_idx on public.casing_strings (wellbore_id);

-- ============================================================================
-- Activity-state (the work: templates → jobs → stages → events)
-- ============================================================================

create table public.job_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  name        text not null,
  job_type    text not null,          -- JobType: drilling | completion | workover | other
  version     integer not null default 1,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index job_templates_org_id_idx on public.job_templates (org_id);

create table public.template_stage_defs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  template_id   uuid not null references public.job_templates(id) on delete cascade,
  stage_no      integer,
  name          text not null,
  stage_type    text not null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index template_stage_defs_org_id_idx on public.template_stage_defs (org_id);
create index template_stage_defs_template_id_idx on public.template_stage_defs (template_id);

create table public.template_field_defs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  template_id   uuid not null references public.job_templates(id) on delete cascade,
  scope         text not null         -- FieldScope (required in @valor/core)
                  check (scope in ('job', 'stage')),
  key           text not null,
  label         text not null,
  data_type     text not null,        -- FieldDataType: number | text | bool | date | enum
  unit          text,
  "group"       text,
  min_value     double precision,
  max_value     double precision,
  enum_options  jsonb,
  required      boolean not null default false,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index template_field_defs_org_id_idx on public.template_field_defs (org_id);
create index template_field_defs_template_id_idx on public.template_field_defs (template_id);

create table public.jobs (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs(id) on delete cascade,
  well_id           uuid not null references public.wells(id) on delete cascade,
  wellbore_id       uuid references public.wellbores(id) on delete set null,
  template_id       uuid not null references public.job_templates(id) on delete restrict,
  name              text not null,
  job_type          text not null,
  status            text not null default 'planned',
  afe_number        text,
  planned_start     timestamptz,
  planned_end       timestamptz,
  actual_start      timestamptz,
  actual_end        timestamptz,
  rig_id            text,
  primary_vendor_id text,             -- soft ref to a vendor_key (vendors is a JSONB module table keyed by text) — no FK
  created_by        uuid not null,    -- soft ref to auth.users — no FK so seed/demo data is portable; required in @valor/core Job.createdBy
  created_at        timestamptz not null default now()
);
create index jobs_org_id_idx on public.jobs (org_id);
create index jobs_well_id_idx on public.jobs (well_id);
create index jobs_wellbore_id_idx on public.jobs (wellbore_id);
create index jobs_template_id_idx on public.jobs (template_id);

create table public.stages (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  job_id        uuid not null references public.jobs(id) on delete cascade,
  stage_no      integer not null,
  name          text not null,
  stage_type    text not null,
  status        text not null default 'planned',
  planned_start timestamptz,
  actual_start  timestamptz,
  actual_end    timestamptz,
  depth_in_ft   double precision,
  depth_out_ft  double precision,
  notes         text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);
create index stages_org_id_idx on public.stages (org_id);
create index stages_job_id_idx on public.stages (job_id);

create table public.job_status_history (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  job_id      uuid not null references public.jobs(id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_by  uuid not null,          -- soft ref to auth.users; required in @valor/core JobStatusHistory.changedBy
  changed_at  timestamptz not null default now(),
  note        text,
  created_at  timestamptz not null default now()
);
create index job_status_history_org_id_idx on public.job_status_history (org_id);
create index job_status_history_job_id_idx on public.job_status_history (job_id);

create table public.events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  job_id        uuid not null references public.jobs(id) on delete cascade,
  stage_id      uuid references public.stages(id) on delete set null,
  kind          text not null,        -- EventType: activity | npt | milestone | hse | note
  detail        jsonb,
  at_time       timestamptz,
  created_at    timestamptz not null default now()
);
create index events_org_id_idx on public.events (org_id);
create index events_job_id_idx on public.events (job_id);
create index events_stage_id_idx on public.events (stage_id);

-- Typed-EAV bag for template-defined custom fields on jobs/stages.
create table public.field_values (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  entity_type   text not null,        -- 'job' | 'stage'
  entity_id     uuid not null,
  field_key     text not null,
  value         jsonb,
  created_at    timestamptz not null default now(),
  unique (org_id, entity_type, entity_id, field_key)
);
create index field_values_org_id_idx on public.field_values (org_id);
create index field_values_entity_idx on public.field_values (entity_type, entity_id);

-- ============================================================================
-- Modules — JSONB payloads mirroring the Local DB snapshot collections.
-- The front-end persists whole objects today (save*/load* on the Repository),
-- so each row carries a `payload jsonb` of the core type. A later migration can
-- normalize these into typed columns. One row per logical record, scoped by org.
-- ============================================================================

-- One row per ChannelDef (data-manager). channel_key is the natural key so the
-- adapter can upsert the whole set idempotently per org.
create table public.channels (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  channel_key   text not null,        -- ChannelDef.id
  payload       jsonb not null,
  created_at    timestamptz not null default now(),
  unique (org_id, channel_key)
);
create index channels_org_id_idx on public.channels (org_id);

-- One row per Vendor (office-ops). vendor_key = Vendor.id.
create table public.vendors (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  vendor_key    text not null,        -- Vendor.id
  payload       jsonb not null,
  created_at    timestamptz not null default now(),
  unique (org_id, vendor_key)
);
create index vendors_org_id_idx on public.vendors (org_id);

-- Contacts belong to a vendor. Kept as its own table per the plan's table list,
-- though today contacts are embedded inside the Vendor payload.
create table public.contacts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  vendor_id     uuid references public.vendors(id) on delete cascade,
  payload       jsonb not null,
  created_at    timestamptz not null default now()
);
create index contacts_org_id_idx on public.contacts (org_id);
create index contacts_vendor_id_idx on public.contacts (vendor_id);

-- One row per AfeLine (office-ops). afe_key = AfeLine.id.
create table public.afe_lines (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  afe_key       text not null,        -- AfeLine.id
  payload       jsonb not null,
  created_at    timestamptz not null default now(),
  unique (org_id, afe_key)
);
create index afe_lines_org_id_idx on public.afe_lines (org_id);

-- One row per RigDay, keyed by a caller-supplied string id.
create table public.rig_days (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  rig_day_key   text not null,        -- caller-supplied RigDay id
  payload       jsonb not null,
  created_at    timestamptz not null default now(),
  unique (org_id, rig_day_key)
);
create index rig_days_org_id_idx on public.rig_days (org_id);

-- One row per WellSetup, keyed by the owning well id (string today).
create table public.well_setups (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  well_id       text not null,        -- WellSetup is keyed by well id (string in core today)
  payload       jsonb not null,
  created_at    timestamptz not null default now(),
  unique (org_id, well_id)
);
create index well_setups_org_id_idx on public.well_setups (org_id);

-- One row per dashboard layout, keyed by owner id (a string user/owner key).
create table public.dashboards (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs(id) on delete cascade,
  owner_id      text not null,        -- DashboardLayout.ownerId
  payload       jsonb not null,
  created_at    timestamptz not null default now(),
  unique (org_id, owner_id)
);
create index dashboards_org_id_idx on public.dashboards (org_id);
