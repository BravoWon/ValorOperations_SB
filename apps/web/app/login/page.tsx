'use client';

import * as React from 'react';
import { signInWithMicrosoft } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase/config';

export default function LoginPage() {
  const configured = supabaseConfigured();

  function continueDemo() {
    // Mock/static demo only: the same non-signed gate cookie as before so the
    // walkthrough flow is preserved when Supabase is not configured.
    document.cookie = 'valor_demo_auth=1; path=/; max-age=86400; samesite=lax';
    const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
    window.location.assign(`${base}/`);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.06] blur-[120px]"
      />
      <div className="animate-fade-up glass-strong relative w-full max-w-md rounded-xl px-8 py-10 sm:px-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 font-display text-2xl text-gold-light shadow-[0_0_28px_-8px_rgba(201,168,76,0.7)]">
            V
          </span>
          <div className="eyebrow mb-2">Secure Access</div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-cream">Valor Operations</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Sign in to continue to your workspaces.</p>
        </div>

        {configured ? (
          <button
            type="button"
            onClick={() => signInWithMicrosoft('/')}
            className="lift flex w-full items-center justify-center gap-2 rounded-md border border-gold/50 bg-gold/15 px-4 py-2.5 font-mono text-[0.75rem] font-medium uppercase tracking-[0.18em] text-gold-light shadow-gold-glow transition-colors hover:bg-gold/25 hover:text-cream"
          >
            Sign in with Microsoft
          </button>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={continueDemo}
              className="lift w-full rounded-md border border-gold/50 bg-gold/15 px-4 py-2.5 font-mono text-[0.75rem] font-medium uppercase tracking-[0.18em] text-gold-light shadow-gold-glow transition-colors hover:bg-gold/25 hover:text-cream"
            >
              Continue (demo mode)
            </button>
            <p className="text-center font-mono text-[0.625rem] leading-relaxed tracking-wide text-muted-foreground/50">
              Demo mode &mdash; Supabase isn&rsquo;t configured, so this opens the walkthrough with sample data only.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
