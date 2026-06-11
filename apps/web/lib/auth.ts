'use client';

import { useEffect, useState } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Start the Microsoft/Entra OAuth flow; returns to /auth/callback then `next`. */
export async function signInWithMicrosoft(next = '/') {
  const supabase = createSupabaseBrowserClient();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const redirectTo = `${origin}${base}/auth/callback?next=${encodeURIComponent(next)}`;
  return supabase.auth.signInWithOAuth({ provider: 'azure', options: { redirectTo, scopes: 'email' } });
}

export async function signOut() {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signOut();
}

/** Subscribe to the current session; `loading` until the first resolution. */
export function useSession(): { session: Session | null; user: User | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) => {
        if (active) setSession(data.session);
      })
      .catch(() => { /* network/config error — fall through to loading=false */ })
      .finally(() => { if (active) setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e: AuthChangeEvent, s: Session | null) => {
      if (active) setSession(s);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
