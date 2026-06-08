-- rls.test.sql — pgTAP proof of tenant isolation (RLS).
--
-- SCAFFOLD: committed but NOT run here. Run later against a live project with:
--   supabase test db
-- once 0001_schema.sql + 0002_rls.sql have been applied (`supabase db push`).
--
-- What it proves:
--   * Two orgs (A, B), two auth.users (A, B), each user a member of one org.
--   * A well seeded in each org.
--   * Acting AS user A (authenticated role + request.jwt.claim.sub = A's id):
--       1. SELECT on wells returns exactly org A's well (tenant read isolation).
--       2. INSERT of a well into org B is rejected by the WITH CHECK policy
--          (tenant write isolation).
--
-- Seeding runs as the table owner (RLS bypassed for the owner / before FORCE),
-- then we drop to the `authenticated` role and impersonate user A via the JWT
-- claim that auth.uid() reads, exactly as Supabase does at runtime.

begin;

select plan(4);

-- --- Seed (owner context: RLS not yet enforced for us) -----------------------

-- Two auth users. gen_random_uuid() ids captured in psql vars for reuse.
insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-0000000000a1', 'user-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'user-b@example.com');

-- Two orgs.
insert into public.orgs (id, name)
values
  ('00000000-0000-0000-0000-00000000a000', 'Org A'),
  ('00000000-0000-0000-0000-00000000b000', 'Org B');

-- Memberships: user A → org A, user B → org B.
insert into public.memberships (org_id, user_id, role)
values
  ('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000b000', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- A pad in each org (wells require a pad FK), then a well in each org.
insert into public.assets (id, org_id, name)
values
  ('00000000-0000-0000-0000-00000000a100', '00000000-0000-0000-0000-00000000a000', 'Asset A'),
  ('00000000-0000-0000-0000-00000000b100', '00000000-0000-0000-0000-00000000b000', 'Asset B');

insert into public.pads (id, org_id, asset_id, name)
values
  ('00000000-0000-0000-0000-00000000a200', '00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-00000000a100', 'Pad A'),
  ('00000000-0000-0000-0000-00000000b200', '00000000-0000-0000-0000-00000000b000', '00000000-0000-0000-0000-00000000b100', 'Pad B');

insert into public.wells (id, org_id, pad_id, name)
values
  ('00000000-0000-0000-0000-00000000a300', '00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-00000000a200', 'Well A-1'),
  ('00000000-0000-0000-0000-00000000b300', '00000000-0000-0000-0000-00000000b000', '00000000-0000-0000-0000-00000000b200', 'Well B-1');

-- --- Act as user A (authenticated) ------------------------------------------
-- Drop to the authenticated role and supply the JWT `sub` claim that
-- auth.uid() resolves. set local keeps it scoped to this transaction.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- 1. User A sees exactly org A's well, and nothing from org B.
select results_eq(
  $$ select name from public.wells order by name $$,
  $$ values ('Well A-1'::text) $$,
  'user A sees only org A wells'
);

-- 2. User A sees exactly one well row total (org B's row is invisible).
select is(
  (select count(*)::int from public.wells),
  1,
  'user A sees exactly one well (org B hidden)'
);

-- 3. User A cannot insert a well into org B — WITH CHECK rejects it.
select throws_ok(
  $$ insert into public.wells (org_id, pad_id, name)
     values ('00000000-0000-0000-0000-00000000b000',
             '00000000-0000-0000-0000-00000000b200',
             'Sneaky B Well') $$,
  '42501',  -- insufficient_privilege: new row violates row-level security policy
  null,
  'user A cannot insert a well into org B'
);

-- 4. Privilege-escalation guard: user A (owner of org A, but NOT a member of
--    org B) cannot grant themselves a membership in org B. is_org_admin('B')
--    is false for A, so the admin-gated WITH CHECK rejects the insert. Without
--    this, A could self-add to org B and read all of B's rows.
select throws_ok(
  $$ insert into public.memberships (org_id, user_id, role)
     values ('00000000-0000-0000-0000-00000000b000',
             '00000000-0000-0000-0000-0000000000a1',
             'owner') $$,
  '42501',
  null,
  'user A cannot self-add a membership into org B'
);

select * from finish();

rollback;
