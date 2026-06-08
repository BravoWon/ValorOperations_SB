// apps/web/components/role-gate.tsx
'use client';

import { usePathname } from 'next/navigation';
import { useRole } from '@/components/role-provider';
import { roleSatisfies } from '@/lib/role';
import { minRoleForPath } from '@/lib/planes';
import { RoleBlocked } from '@/components/role-blocked';

/**
 * Gates hub content: if the current role can't see this path, show RoleBlocked.
 * First paint uses RoleProvider's default (owner) and refines from the
 * `valor_demo_role` cookie in an effect, so a low-privilege deep-link briefly
 * renders the page before swapping to RoleBlocked. (Unlike AuthGate, which holds
 * `null` until its cookie check, this gate does not suppress that first paint —
 * acceptable because it's a demo IA affordance, NOT security; real enforcement is
 * server-side RLS once Supabase auth lands.)
 */
export function RoleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useRole();
  const min = minRoleForPath(pathname);
  if (!roleSatisfies(role, min)) return <RoleBlocked required={min} />;
  return <>{children}</>;
}
