'use client';

import { LogOut } from 'lucide-react';

/**
 * Clears the demo gate cookie and returns to /login via a full navigation so
 * the middleware re-evaluates on the next request. Demo placeholder only.
 */
export function SignOutLink({ className }: { className?: string }) {
  function signOut() {
    document.cookie = 'valor_demo_auth=; path=/; max-age=0';
    window.location.assign('/login');
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className={
        className ??
        'inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-gold/30 hover:text-cream'
      }
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign out
    </button>
  );
}
