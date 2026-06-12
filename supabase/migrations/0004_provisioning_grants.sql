-- 0004_provisioning_grants.sql
-- Harden the H3a provisioning RPCs against `anon` EXECUTE (defense in depth).
--
-- Supabase's platform default privileges (ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE
-- ON FUNCTIONS TO anon, authenticated, service_role) add an explicit per-role EXECUTE
-- grant on every new function in `public`. 0003's `revoke ... from public` removes the
-- PUBLIC pseudo-role grant but NOT those explicit role grants, so `anon` retained EXECUTE
-- on the four admin RPCs (confirmed via pg_proc.proacl after applying 0003).
--
-- Each RPC already guards `is_org_admin(p_org_id)` first — an `anon` caller has
-- auth.uid() = null, so it raises 42501 before touching any data — so this is not an
-- exploit fix; it makes the grant surface match 0003's authenticated-only intent and
-- clears the Supabase security advisor. `authenticated` keeps EXECUTE (the app calls
-- these as the signed-in user; the in-function admin check is the real boundary).
--
-- `revoke all` (rather than `revoke execute`) mirrors 0002/0003 — for a function EXECUTE
-- is the only grantable privilege, so the two are equivalent here.

revoke all on function
  public.org_members(uuid),
  public.invite_member(uuid, text, text),
  public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid)
from anon, public;
