// apps/web/components/role-provider.tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Role } from '@/lib/role';
import { DEFAULT_ROLE, ROLE_COOKIE, parseRoleCookie } from '@/lib/role';

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
}

const RoleContext = createContext<RoleContextValue>({ role: DEFAULT_ROLE, setRole: () => {} });

export function RoleProvider({ children }: { children: React.ReactNode }) {
  // Seed the most-privileged default (owner) and refine from the cookie after
  // mount. This deliberately does NOT mirror AuthGate (which holds `null` until
  // its check): seeding owner lets the hub's server-rendered HTML keep its real
  // content on normal builds (the layout only applies AuthGate on static export
  // for the same reason). The cost is a brief above-role flash for a low-privilege
  // deep-link before the cookie refines — accepted, since this is a demo IA gate,
  // not security (real enforcement is server-side RLS once Supabase auth lands).
  const [role, setRoleState] = useState<Role>(DEFAULT_ROLE);

  useEffect(() => {
    setRoleState(parseRoleCookie(document.cookie));
  }, []);

  const setRole = useCallback((r: Role) => {
    document.cookie = `${ROLE_COOKIE}=${r}; path=/; max-age=86400; samesite=lax`;
    setRoleState(r);
  }, []);

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}
