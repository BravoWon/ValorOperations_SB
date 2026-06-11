-- provisioning.test.sql — pgTAP proof of the H3a member-management RPCs.
-- SCAFFOLD: run at activation with `supabase test db` once 0001..0003 are applied.

begin;
select plan(10);

-- Seed: three users, two orgs, memberships (A: a1 owner + a2 viewer; B: b1 owner).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin-a@example.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'viewer-a@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@example.com');
insert into public.orgs (id, name) values
  ('00000000-0000-0000-0000-00000000a000', 'Org A'),
  ('00000000-0000-0000-0000-00000000b000', 'Org B');
insert into public.memberships (org_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a2', 'viewer'),
  ('00000000-0000-0000-0000-00000000b000', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- Act as a1 (owner/admin of Org A). RPCs are SECURITY DEFINER; the guard reads auth.uid().
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';

-- 1. org_members(A) returns A's members with emails.
select results_eq(
  $$ select email from public.org_members('00000000-0000-0000-0000-00000000a000'::uuid) order by email $$,
  $$ values ('admin-a@example.com'::text), ('viewer-a@example.com'::text) $$,
  'admin sees org A members with emails'
);

-- 2-4. invite: existing user -> added; repeat -> already_member; unknown -> not_found.
select is(public.invite_member('00000000-0000-0000-0000-00000000a000'::uuid, 'owner-b@example.com', 'viewer'),
          'added', 'invite existing user -> added');
select is(public.invite_member('00000000-0000-0000-0000-00000000a000'::uuid, 'owner-b@example.com', 'viewer'),
          'already_member', 'invite existing member -> already_member');
select is(public.invite_member('00000000-0000-0000-0000-00000000a000'::uuid, 'nobody@example.com', 'viewer'),
          'not_found', 'invite unknown email -> not_found');

-- 5. set_member_role: promote the viewer (a2) to admin.
select lives_ok(
  $$ select public.set_member_role('00000000-0000-0000-0000-00000000a000'::uuid, '00000000-0000-0000-0000-0000000000a2'::uuid, 'admin') $$,
  'admin can set a member role'
);

-- 6-7. last-owner guard: demote/remove the only owner (a1) -> raises.
select throws_ok(
  $$ select public.set_member_role('00000000-0000-0000-0000-00000000a000'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid, 'viewer') $$,
  '42501', null, 'cannot demote the last owner'
);
select throws_ok(
  $$ select public.remove_member('00000000-0000-0000-0000-00000000a000'::uuid, '00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  '42501', null, 'cannot remove the last owner'
);

-- 8. remove a non-owner member (b1, added in step 2) -> succeeds.
select lives_ok(
  $$ select public.remove_member('00000000-0000-0000-0000-00000000a000'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid) $$,
  'admin can remove a non-owner member'
);

-- Act as b1 — owner of B, NOT a member/admin of A: a non-admin against A.
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b1';

-- 9-10. non-admin is denied (42501) on list + invite.
select throws_ok(
  $$ select * from public.org_members('00000000-0000-0000-0000-00000000a000'::uuid) $$,
  '42501', null, 'non-admin cannot list members'
);
select throws_ok(
  $$ select public.invite_member('00000000-0000-0000-0000-00000000a000'::uuid, 'admin-a@example.com', 'viewer') $$,
  '42501', null, 'non-admin cannot invite'
);

select * from finish();
rollback;
