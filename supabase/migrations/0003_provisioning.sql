-- 0003_provisioning.sql — admin member-management RPCs (Auth H3a).
--
-- SCAFFOLD: committed but NOT run here. Applied at activation (`supabase db push`)
-- and proven via supabase/tests/provisioning.test.sql (`supabase test db`).
--
-- The browser's anon role cannot read auth.users (emails) and memberships RLS
-- (memberships_self_select) hides other members — so org owners/admins manage
-- membership through these four SECURITY DEFINER RPCs. Each FIRST checks
-- is_org_admin(p_org_id) -> 42501, so a non-admin (or anon, whose auth.uid() is
-- null) is denied. EXECUTE is revoked from public and granted only to authenticated.

-- 1. List the org's members (with emails from auth.users). Admin only.
create or replace function public.org_members(p_org_id uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, m.role, m.created_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.org_id = p_org_id
    order by m.created_at;
end;
$$;
revoke all on function public.org_members(uuid) from public;
grant execute on function public.org_members(uuid) to authenticated;

-- 2. Invite an EXISTING user (must have signed in via SSO -> exists in auth.users)
--    to the org by email. Returns 'added' | 'already_member' | 'not_found'.
create or replace function public.invite_member(p_org_id uuid, p_email text, p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'ops', 'field', 'vendor', 'viewer') then
    raise exception 'invalid role: %', p_role using errcode = '22023';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user_id is null then
    return 'not_found';
  end if;
  if exists (select 1 from public.memberships where org_id = p_org_id and user_id = v_user_id) then
    return 'already_member';
  end if;

  insert into public.memberships (org_id, user_id, role) values (p_org_id, v_user_id, p_role);
  return 'added';
end;
$$;
revoke all on function public.invite_member(uuid, text, text) from public;
grant execute on function public.invite_member(uuid, text, text) to authenticated;

-- 3. Change a member's role. Admin only; cannot demote the org's last owner.
create or replace function public.set_member_role(p_org_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'ops', 'field', 'vendor', 'viewer') then
    raise exception 'invalid role: %', p_role using errcode = '22023';
  end if;
  if p_role <> 'owner'
     and exists (select 1 from public.memberships where org_id = p_org_id and user_id = p_user_id and role = 'owner')
     and (select count(*) from public.memberships where org_id = p_org_id and role = 'owner') <= 1 then
    raise exception 'cannot demote the last owner' using errcode = '42501';
  end if;
  update public.memberships set role = p_role where org_id = p_org_id and user_id = p_user_id;
end;
$$;
revoke all on function public.set_member_role(uuid, uuid, text) from public;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;

-- 4. Remove a member. Admin only; cannot remove the org's last owner.
create or replace function public.remove_member(p_org_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if exists (select 1 from public.memberships where org_id = p_org_id and user_id = p_user_id and role = 'owner')
     and (select count(*) from public.memberships where org_id = p_org_id and role = 'owner') <= 1 then
    raise exception 'cannot remove the last owner' using errcode = '42501';
  end if;
  delete from public.memberships where org_id = p_org_id and user_id = p_user_id;
end;
$$;
revoke all on function public.remove_member(uuid, uuid) from public;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
