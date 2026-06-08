// apps/web/components/role-switcher.tsx
'use client';

import type { Role } from '@/lib/role';
import { ALL_ROLES } from '@/lib/role';
import { useRole } from '@/components/role-provider';

/** Demo affordance: switch the signed-in role to see the surface adapt. */
export function RoleSwitcher() {
  const { role, setRole } = useRole();
  return (
    <label className="mb-6 flex items-center gap-2 px-2">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground/70">Role</span>
      <select
        aria-label="Demo role"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className="flex-1 rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-wider text-cream outline-none transition-colors focus:border-gold/50"
      >
        {ALL_ROLES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
    </label>
  );
}
