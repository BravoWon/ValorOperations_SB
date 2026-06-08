// apps/web/components/role-provider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Role } from '@/lib/role';
import { DEFAULT_ROLE, ROLE_COOKIE, parseRoleCookie } from '@/lib/role';

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
}

const RoleContext = createContext<RoleContextValue>({ role: DEFAULT_ROLE, setRole: () => {} });

export function RoleProvider({ children }: { children: React.ReactNode }) {
  // Start at the default; refine from the cookie after mount (so SSR/first paint
  // never hides content for the default owner, mirroring AuthGate's approach).
  const [role, setRoleState] = useState<Role>(DEFAULT_ROLE);

  useEffect(() => {
    setRoleState(parseRoleCookie(document.cookie));
  }, []);

  const setRole = (r: Role) => {
    document.cookie = `${ROLE_COOKIE}=${r}; path=/; max-age=86400; samesite=lax`;
    setRoleState(r);
  };

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}
