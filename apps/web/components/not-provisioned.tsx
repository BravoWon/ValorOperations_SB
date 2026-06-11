'use client';

import { signOut } from '@/lib/auth';

/** Signed in, but no membership in the active org — an explicit state, not a broken app. */
export function NotProvisioned() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass-strong w-full max-w-md rounded-xl px-8 py-10 text-center">
        <div className="eyebrow mb-2">Access not provisioned</div>
        <h1 className="font-display text-xl text-cream">You&rsquo;re signed in, but not a member of this workspace yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ask an administrator to add you to the organization, then sign in again.</p>
        <button
          type="button"
          onClick={() => signOut().then(() => window.location.assign('/login'))}
          className="mt-6 inline-block rounded-md border border-gold/40 bg-gold/[0.06] px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
