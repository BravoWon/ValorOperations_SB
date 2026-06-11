'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabaseConfigured } from '@/lib/supabase/config';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { NotProvisioned } from '@/components/not-provisioned';
import { resolveActiveOrgClient, writeActiveOrgCookie } from '@/lib/active-org';

export interface OrgInfo { id: string; name: string; }
interface ActiveOrgContextValue { orgs: OrgInfo[]; activeOrgId: string; setActiveOrg: (id: string) => void; }

const ActiveOrgContext = createContext<ActiveOrgContextValue | null>(null);
export function useActiveOrg(): ActiveOrgContextValue | null { return useContext(ActiveOrgContext); }

type State =
  | { kind: 'checking' }
  | { kind: 'ok'; orgs: OrgInfo[]; activeOrgId: string }
  | { kind: 'denied' }
  | { kind: 'error' };

// PostgREST embeds a to-one relation as an object, but the typed client can infer
// an array — normalize both.
type MembershipRow = { org_id: string; orgs: { name: string } | { name: string }[] | null };

/**
 * Evolves H1's RequireMembership: fetch the user's memberships (RLS-scoped to their
 * own rows) with org names, gate (0 → NotProvisioned, error → retry), validate the
 * active-org cookie is one of theirs (self-heal + reload if not), and expose the org
 * context. Mock mode passes children through.
 */
export function ActiveOrgProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'checking' });
  const healedRef = useRef(false);

  useEffect(() => {
    if (!supabaseConfigured()) return;
    let active = true;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (active) setState({ kind: 'ok', orgs: [], activeOrgId: '' }); return; } // middleware gates
      const { data, error } = await supabase.from('memberships').select('org_id, orgs(name)');
      if (!active) return;
      if (error) { setState({ kind: 'error' }); return; }
      const orgs: OrgInfo[] = ((data ?? []) as unknown as MembershipRow[])
        .map((r) => {
          const org = Array.isArray(r.orgs) ? r.orgs[0] : r.orgs;
          return { id: r.org_id, name: org?.name ?? r.org_id };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      if (orgs.length === 0) { setState({ kind: 'denied' }); return; }
      const resolved = resolveActiveOrgClient();
      if (orgs.some((o) => o.id === resolved)) {
        setState({ kind: 'ok', orgs, activeOrgId: resolved });
      } else if (!healedRef.current) {
        healedRef.current = true;
        const first = orgs[0];
        if (first) {
          writeActiveOrgCookie(first.id);
          window.location.reload();
        }
      }
    })();
    return () => { active = false; };
  }, []);

  const setActiveOrg = (id: string) => {
    writeActiveOrgCookie(id);
    window.location.reload();
  };

  if (!supabaseConfigured()) return <>{children}</>;
  if (state.kind === 'checking') return null;
  if (state.kind === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12 text-sm text-muted-foreground">
        Unable to verify access right now &mdash; please retry.
      </main>
    );
  }
  if (state.kind === 'denied') return <NotProvisioned />;
  return (
    <ActiveOrgContext.Provider value={{ orgs: state.orgs, activeOrgId: state.activeOrgId, setActiveOrg }}>
      {children}
    </ActiveOrgContext.Provider>
  );
}
