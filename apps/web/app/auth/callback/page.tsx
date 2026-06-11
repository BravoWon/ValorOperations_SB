'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { supabaseConfigured } from '@/lib/supabase/config';

const Pending = () => (
  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Signing you in&hellip;</p>
);

/**
 * Client-side OAuth code exchange (PKCE). A page (not a route handler) so the
 * static-export build still succeeds. `useSearchParams` must live under a
 * <Suspense> boundary (Next 15 App Router) or `next build` fails.
 */
function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured()) { setError(true); return; }
    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      setError(true);
      return;
    }
    supabase.auth
      .exchangeCodeForSession(window.location.href)
      .then(({ error: err }: { error: { message: string } | null }) => {
        if (err) { setError(true); return; }
        router.replace(params.get('next') || '/');
      })
      .catch(() => setError(true));
  }, [router, params]);

  if (error) {
    return (
      <>
        <h1 className="font-display text-xl text-cream">We couldn&rsquo;t complete sign-in</h1>
        <p className="mt-2 text-sm text-muted-foreground">The sign-in link may have expired.</p>
        <a href="/login" className="mt-5 inline-block font-mono text-[0.75rem] uppercase tracking-wider text-gold-light hover:text-cream">
          Back to sign in
        </a>
      </>
    );
  }
  return <Pending />;
}

export default function CallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass-strong w-full max-w-md rounded-xl px-8 py-10 text-center">
        <Suspense fallback={<Pending />}>
          <CallbackInner />
        </Suspense>
      </div>
    </main>
  );
}
