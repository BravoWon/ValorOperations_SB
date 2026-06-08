// apps/web/components/role-gate.tsx
'use client';

import { usePathname } from 'next/navigation';
import { useRole } from '@/components/role-provider';
import { roleSatisfies } from '@/lib/role';
import { minRoleForPath } from '@/lib/planes';
import { RoleBlocked } from '@/components/role-blocked';

/**
 * Gates hub content: if the current role can't see this path, show RoleBlocked.
 * First paint uses RoleProvider's default (owner) and refines from the cookie in
 * an effect, so a low-privilege deep-link briefly shows content before swapping to
 * RoleBlocked — same behaviour as AuthGate. This is a demo IA gate, NOT security.
 */
export function RoleGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useRole();
  const min = minRoleForPath(pathname);
  if (!roleSatisfies(role, min)) return <RoleBlocked required={min} />;
  return <>{children}</>;
}
