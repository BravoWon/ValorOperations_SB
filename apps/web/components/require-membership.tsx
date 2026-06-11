'use client';

import { useEffect, useState } from 'react';
import { supabaseConfigured } from '@/lib/supabase/config';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { NotProvisioned } from '@/components/not-provisioned';

/**
 * Client gate: when Supabase is configured and a session exists, confirm the user
 * has a membership in the active org (ORG_ID) — RLS allows reading your own
 * membership rows. No membership → <NotProvisioned/>. In mock mode (or no
 * session, which middleware already handles) it passes children through.
 */
export function RequireMembership({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'denied'>(supabaseConfigured() ? 'checking' : 'ok');

  useEffect(() => {
    if (!supabaseConfigured()) return;
    let active = true;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (active) setState('ok'); return; } // middleware gates unauthenticated
      const orgId = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID as string;
      const { data, error } = await supabase.from('memberships').select('org_id').eq('org_id', orgId).limit(1);
      if (!active) return;
      if (error) { setState('ok'); return; } // transient error — don't block on the membership check
      setState((data?.length ?? 0) > 0 ? 'ok' : 'denied');
    })();
    return () => { active = false; };
  }, []);

  if (state === 'checking') return null;
  if (state === 'denied') return <NotProvisioned />;
  return <>{children}</>;
}
