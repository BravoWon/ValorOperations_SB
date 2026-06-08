-- 0002_rls.sql — Row Level Security: tenant isolation for every table.
--
-- SCAFFOLD: committed but NOT run yet. Proven later via supabase/tests/rls.test.sql
-- (`supabase test db`) once a live project exists. See supabase/README.md.
--
-- Model: a user belongs to one or more orgs via public.memberships. A row is
-- visible/writable iff its org_id is one of the caller's orgs. memberships and
-- orgs get bespoke policies (you see your own membership rows; you see an org
-- if you're a member of it).
--
-- Performance: auth.uid() is wrapped in (select ...) so Postgres evaluates it
-- once per statement instead of once per row (per the supabase RLS-performance
-- guidance). memberships(user_id) and every org_id column are indexed in 0001.
--
-- All policies target the `authenticated` role explicitly (TO authenticated):
-- role alone is not authorization — each policy also carries the org predicate.

-- ============================================================================
-- Authorization helper — is the caller an owner/admin of the given org?
--
-- SECURITY DEFINER so the inner read of public.memberships runs as the function
-- owner with RLS bypassed. That is deliberate and required: a policy ON
-- public.memberships that itself SELECTs public.memberships would recurse under
-- RLS. Centralizing the admin predicate here also keeps it in one place.
-- STABLE + a pinned search_path are the standard hardening for such helpers.
-- ============================================================================
create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = p_org_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

-- ============================================================================
-- Tenancy tables — bespoke policies
-- ============================================================================

alter table public.orgs enable row level security;

-- You can see an org if you are a member of it.
create policy "orgs_member_select" on public.orgs
  for select to authenticated
  using (
    id in (
      select org_id from public.memberships
      where user_id = (select auth.uid())
    )
  );

alter table public.memberships enable row level security;

-- You can read your own membership rows.
create policy "memberships_self_select" on public.memberships
  for select to authenticated
  using ( user_id = (select auth.uid()) );

-- Writes are admin-gated, NOT self-service. A self-write policy
-- (user_id = auth.uid()) would be a privilege-escalation vector: any user could
-- INSERT a membership for themselves into an arbitrary org and thereby gain
-- access to that org's rows through every other tenant policy. Only an existing
-- owner/admin of the SAME org may create/modify/remove its memberships.
--
-- Bootstrapping: the first owner of a brand-new org is seeded with the
-- service-role key (which bypasses RLS) — see supabase/README.md.
create policy "memberships_admin_write" on public.memberships
  for all to authenticated
  using ( public.is_org_admin(org_id) )
  with check ( public.is_org_admin(org_id) );

-- ============================================================================
-- Tenant tables — uniform org-isolation policies.
--
-- For each table: enable RLS, a SELECT policy (org match) and an ALL policy
-- (org match in both USING and WITH CHECK). The ALL policy covers
-- insert/update/delete; the dedicated SELECT policy makes read intent explicit
-- and ensures UPDATE (which must SELECT the row first) always has a read path.
-- ============================================================================

-- Condition-state
alter table public.assets enable row level security;
create policy "assets_tenant_select" on public.assets for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "assets_tenant_write" on public.assets for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.pads enable row level security;
create policy "pads_tenant_select" on public.pads for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "pads_tenant_write" on public.pads for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.wells enable row level security;
create policy "wells_tenant_select" on public.wells for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "wells_tenant_write" on public.wells for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.wellbores enable row level security;
create policy "wellbores_tenant_select" on public.wellbores for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "wellbores_tenant_write" on public.wellbores for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.formations enable row level security;
create policy "formations_tenant_select" on public.formations for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "formations_tenant_write" on public.formations for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.casing_strings enable row level security;
create policy "casing_strings_tenant_select" on public.casing_strings for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "casing_strings_tenant_write" on public.casing_strings for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

-- Activity-state
alter table public.job_templates enable row level security;
create policy "job_templates_tenant_select" on public.job_templates for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "job_templates_tenant_write" on public.job_templates for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.template_stage_defs enable row level security;
create policy "template_stage_defs_tenant_select" on public.template_stage_defs for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "template_stage_defs_tenant_write" on public.template_stage_defs for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.template_field_defs enable row level security;
create policy "template_field_defs_tenant_select" on public.template_field_defs for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "template_field_defs_tenant_write" on public.template_field_defs for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.jobs enable row level security;
create policy "jobs_tenant_select" on public.jobs for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "jobs_tenant_write" on public.jobs for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.stages enable row level security;
create policy "stages_tenant_select" on public.stages for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "stages_tenant_write" on public.stages for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.job_status_history enable row level security;
create policy "job_status_history_tenant_select" on public.job_status_history for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "job_status_history_tenant_write" on public.job_status_history for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.events enable row level security;
create policy "events_tenant_select" on public.events for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "events_tenant_write" on public.events for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.field_values enable row level security;
create policy "field_values_tenant_select" on public.field_values for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "field_values_tenant_write" on public.field_values for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

-- Modules (JSONB payloads)
alter table public.channels enable row level security;
create policy "channels_tenant_select" on public.channels for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "channels_tenant_write" on public.channels for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.vendors enable row level security;
create policy "vendors_tenant_select" on public.vendors for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "vendors_tenant_write" on public.vendors for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.contacts enable row level security;
create policy "contacts_tenant_select" on public.contacts for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "contacts_tenant_write" on public.contacts for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.afe_lines enable row level security;
create policy "afe_lines_tenant_select" on public.afe_lines for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "afe_lines_tenant_write" on public.afe_lines for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.rig_days enable row level security;
create policy "rig_days_tenant_select" on public.rig_days for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "rig_days_tenant_write" on public.rig_days for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.well_setups enable row level security;
create policy "well_setups_tenant_select" on public.well_setups for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "well_setups_tenant_write" on public.well_setups for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );

alter table public.dashboards enable row level security;
create policy "dashboards_tenant_select" on public.dashboards for select to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
create policy "dashboards_tenant_write" on public.dashboards for all to authenticated
  using ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) )
  with check ( org_id in (select org_id from public.memberships where user_id = (select auth.uid())) );
