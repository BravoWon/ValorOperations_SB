-- provisioning_grants.test.sql — pgTAP proof of the 0004 grant-surface hardening.
-- SCAFFOLD: run at activation with `supabase test db` once 0001..0004 are applied.
-- Distinct from provisioning.test.sql (which proves runtime behavior as `authenticated`):
-- this asserts the GRANT surface directly, so a future change to Supabase default
-- privileges that re-grants `anon` would fail here.

begin;
select plan(8);

-- anon must NOT have EXECUTE on the admin provisioning RPCs (0004 revokes it).
select ok(not has_function_privilege('anon', 'public.org_members(uuid)', 'execute'),
  'anon cannot execute org_members');
select ok(not has_function_privilege('anon', 'public.invite_member(uuid, text, text)', 'execute'),
  'anon cannot execute invite_member');
select ok(not has_function_privilege('anon', 'public.set_member_role(uuid, uuid, text)', 'execute'),
  'anon cannot execute set_member_role');
select ok(not has_function_privilege('anon', 'public.remove_member(uuid, uuid)', 'execute'),
  'anon cannot execute remove_member');

-- authenticated retains EXECUTE (the in-function is_org_admin guard is the real boundary).
select ok(has_function_privilege('authenticated', 'public.org_members(uuid)', 'execute'),
  'authenticated can execute org_members');
select ok(has_function_privilege('authenticated', 'public.invite_member(uuid, text, text)', 'execute'),
  'authenticated can execute invite_member');
select ok(has_function_privilege('authenticated', 'public.set_member_role(uuid, uuid, text)', 'execute'),
  'authenticated can execute set_member_role');
select ok(has_function_privilege('authenticated', 'public.remove_member(uuid, uuid)', 'execute'),
  'authenticated can execute remove_member');

select * from finish();
rollback;
