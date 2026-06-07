'use client';

/**
 * ⚠️ DEMO PLACEHOLDER LOGIN — NOT REAL SECURITY.
 *
 * This screen exists only to gate the demo walkthrough. The password is a
 * hard-coded literal checked client-side, and "auth" is a non-signed cookie.
 * There is NO real authentication here. Replace with a real auth provider
 * before this ever leaves a sandbox.
 */

import * as React from 'react';

// Demo-only credential. NOT a secret — see the file banner above.
const DEMO_PASSWORD = 'valor1!';

export default function LoginPage() {
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === DEMO_PASSWORD) {
      // Set the (non-signed, demo-only) gate cookie, then do a FULL navigation
      // so the middleware sees the cookie on the next request.
      document.cookie = 'valor_demo_auth=1; path=/; max-age=86400; samesite=lax';
      window.location.assign('/');
    } else {
      setError(true);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      {/* Decorative gold glow accent above the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.06] blur-[120px]"
      />

      <div className="animate-fade-up glass-strong relative w-full max-w-md rounded-xl px-8 py-10 sm:px-10">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 font-display text-2xl text-gold-light shadow-[0_0_28px_-8px_rgba(201,168,76,0.7)]">
            V
          </span>
          <div className="eyebrow mb-2">Secure Access</div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-cream">
            Valor Operations
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to continue to your workspaces.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-gold/80"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(false);
              }}
              aria-invalid={error}
              aria-describedby={error ? 'password-error' : undefined}
              placeholder="••••••••"
              className="w-full rounded-md border border-gold/20 bg-white/[0.03] px-4 py-2.5 text-sm text-cream placeholder:text-muted-foreground/40 transition-colors focus:border-gold/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-gold/40"
            />
            {error && (
              <p
                id="password-error"
                role="alert"
                className="font-mono text-[0.75rem] tracking-wide text-red"
              >
                Incorrect password — try again.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="lift w-full rounded-md border border-gold/50 bg-gold/15 px-4 py-2.5 font-mono text-[0.75rem] font-medium uppercase tracking-[0.18em] text-gold-light shadow-gold-glow transition-colors hover:bg-gold/25 hover:text-cream focus-visible:outline-none"
          >
            Sign In
          </button>
        </form>

        <div className="hairline my-7 h-px" />

        {/* Demo placeholder disclaimer */}
        <p className="text-center font-mono text-[0.625rem] leading-relaxed tracking-wide text-muted-foreground/50">
          Demo placeholder — this gate is for walkthrough only and provides no
          real security.
        </p>
      </div>
    </main>
  );
}
