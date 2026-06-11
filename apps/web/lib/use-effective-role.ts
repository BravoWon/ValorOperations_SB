'use client';

import type { Role } from '@/lib/role';
import { useRole } from '@/components/role-provider';
import { useActiveOrg } from '@/components/active-org-provider';
import { supabaseConfigured } from '@/lib/supabase/config';

/**
 * The current user's EFFECTIVE role. In configured (live) mode it is their real
 * membership role in the active org (least-privilege 'viewer' fallback when the
 * active-org context isn't available); in mock mode it is the demo Role Switcher
 * value. All three source hooks are called unconditionally (Rules of Hooks);
 * only the returned value branches on supabaseConfigured().
 */
export function useEffectiveRole(): Role {
  const { role } = useRole();
  const activeOrg = useActiveOrg();
  if (supabaseConfigured()) return activeOrg?.activeRole ?? 'viewer';
  return role;
}
