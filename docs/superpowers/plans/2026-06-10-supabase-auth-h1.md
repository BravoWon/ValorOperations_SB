# Supabase Auth — Slice H1 (Auth Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the demo `/login` + cookie-presence middleware with real Microsoft/Entra SSO so a signed-in user's session JWT flows to Supabase and RLS serves their org's data — keeping both build targets green and mock mode as the open demo.

**Architecture:** Hybrid `@supabase/ssr` (the standard Next App Router pattern): a **browser** client for client components and a **server** client (cookies via `next/headers`) for the ~6 server components; the data factory splits into `getRepo()` (client) + `getServerRepo()` (async, server). Microsoft SSO via `signInWithOAuth({ provider: 'azure' })`, a `'use client'` `/auth/callback` page (not a route handler — static export still builds), and middleware that refreshes the session + gates routes only when Supabase is configured. The 3 `generateStaticParams` routes stay static in export/mock and go dynamic when configured.

**Tech Stack:** TypeScript, Next 15 App Router, React 19, `@supabase/ssr` 0.12.0 (pinned) + `@supabase/supabase-js`, Tailwind, Vitest/jsdom. Spec: `docs/superpowers/specs/2026-06-10-supabase-auth-h1-design.md`. Branch: `feat/auth-h1`.

**Commands (from repo root):**
- Web: `corepack pnpm --filter @valor/web test -- <name>` / `test` / `typecheck` / `build`
- Static export build: `STATIC_EXPORT=true corepack pnpm --filter @valor/web build`

**Constraints:** TDD (Vitest/jsdom; mock `@supabase/ssr` / the client modules — they don't resolve under vitest). Both typechecks 0; normal build AND `STATIC_EXPORT=true` build exit 0. `@supabase/ssr` pinned + lockfile committed. Never `service_role` in `NEXT_PUBLIC_*`. Authorization derives only from `memberships`, never `user_metadata`. End every commit body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Prerequisites (manual — not code; do NOT block plan tasks 1-9)

These gate the live end-to-end verification (Task 11), not the build. Document in the PR; the user/Entra admin performs them.

1. **Azure AD (Entra) app registration** — Redirect URI `https://ekswyggelycioeupgfil.supabase.co/auth/v1/callback`. Capture Application (client) ID + a client secret. Single-tenant (`jtech.ai`).
2. **Enable the Azure provider in Supabase** (Dashboard → Authentication → Providers → Azure): client ID + secret + Azure tenant URL `https://login.microsoftonline.com/<tenant-id>`. Add `http://localhost:3000/auth/callback` and the deployed origin's `/auth/callback` to the redirect allowlist; set the Site URL.
3. **Seed the first membership** — after `b.jones@jtech.ai` signs in once (creating the `auth.users` row), attach an `owner` membership in org A (`00000000-0000-0000-0000-000000000001`) via the Management-API SQL path:
   `insert into public.memberships (org_id, user_id, role) values ('00000000-0000-0000-0000-000000000001', '<auth.users id>', 'owner') on conflict do nothing;`

---

## File Structure

- **Create `apps/web/lib/supabase/config.ts`** — lightweight (no `@valor/core`) `supabaseConfigured()` + `decideAuth()` + `PUBLIC_PATHS`. Middleware-safe.
- **Create `apps/web/lib/supabase/browser.ts`** — `createSupabaseBrowserClient()` (client components).
- **Create `apps/web/lib/supabase/server.ts`** — `createSupabaseServerClient()` (server components; `next/headers` cookies).
- **Create `apps/web/lib/supabase/middleware-client.ts`** — `updateSession(request)` (session refresh in middleware).
- **Create `apps/web/lib/auth.ts`** — `signInWithMicrosoft()`, `signOut()`, `useSession()`.
- **Create `apps/web/app/auth/callback/page.tsx`** — `'use client'` PKCE code exchange.
- **Create `apps/web/components/not-provisioned.tsx`** — "signed in, no membership" state.
- **Create `apps/web/components/require-membership.tsx`** — client wrapper; gates on a membership in `ORG_ID`.
- **Create `apps/web/lib/static-params.ts`** — `staticParamsFor(ids)` gating helper.
- **Modify `apps/web/lib/repo.ts`** — re-export `supabaseConfigured` from config; `getRepo()` (browser client) + new `getServerRepo()` (server client).
- **Modify `apps/web/middleware.ts`** — configured-gated session refresh + redirect via `decideAuth`/`updateSession`.
- **Modify `apps/web/app/login/page.tsx`** — Microsoft button (configured) / demo affordance (unconfigured).
- **Modify `apps/web/app/(hub)/layout.tsx`** — `getServerRepo()`; wrap children in `<RequireMembership>`.
- **Modify** the 5 other server call sites + 3 `generateStaticParams` routes.

---

### Task 1: Lightweight auth config — `supabaseConfigured` + `decideAuth` (TDD)

**Files:**
- Create: `apps/web/lib/supabase/config.ts`
- Test: `apps/web/__tests__/auth-config.test.ts`
- Modify: `apps/web/lib/repo.ts` (re-export), `apps/web/__tests__/repo-factory.test.ts` (unchanged — still imports from `@/lib/repo`)

- [ ] **Step 1: Write the failing test** — `apps/web/__tests__/auth-config.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabaseConfigured, decideAuth } from '@/lib/supabase/config';

const KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ORG_ID'] as const;

describe('supabaseConfigured', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
  afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

  it('is false with nothing set', () => { expect(supabaseConfigured()).toBe(false); });
  it('is false with url+key but no org id', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'k';
    expect(supabaseConfigured()).toBe(false);
  });
  it('is false when org id is not a uuid', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'k';
    process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = 'org-valor';
    expect(supabaseConfigured()).toBe(false);
  });
  it('is true with all three (uuid org id)', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'k';
    process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = '00000000-0000-0000-0000-000000000001';
    expect(supabaseConfigured()).toBe(true);
  });
});

describe('decideAuth', () => {
  it('passes everything when unconfigured', () => {
    expect(decideAuth(false, false, '/tickets')).toBe('pass');
  });
  it('passes public paths even without a session', () => {
    expect(decideAuth(true, false, '/login')).toBe('pass');
    expect(decideAuth(true, false, '/auth/callback')).toBe('pass');
  });
  it('redirects a protected path without a session', () => {
    expect(decideAuth(true, false, '/tickets')).toBe('redirect');
  });
  it('passes a protected path with a session', () => {
    expect(decideAuth(true, true, '/tickets')).toBe('pass');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/web test -- auth-config` → FAIL (cannot resolve `@/lib/supabase/config`).

- [ ] **Step 3: Create `apps/web/lib/supabase/config.ts`**

```ts
// Lightweight, dependency-free auth/config helpers safe to import from middleware
// (no @valor/core). The env gate that decides whether the app talks to Supabase.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** All three vars required; ORG_ID must be the org's UUID (no fallback). */
export function supabaseConfigured(): boolean {
  const orgId = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      orgId &&
      UUID_RE.test(orgId),
  );
}

/** Paths reachable without a session (the sign-in flow itself). */
export const PUBLIC_PATHS = ['/login', '/auth/callback'];

/** Pure middleware decision: should this request be redirected to /login? */
export function decideAuth(configured: boolean, hasSession: boolean, pathname: string): 'pass' | 'redirect' {
  if (!configured) return 'pass';
  if (PUBLIC_PATHS.includes(pathname)) return 'pass';
  return hasSession ? 'pass' : 'redirect';
}
```

- [ ] **Step 4: Re-point `apps/web/lib/repo.ts` at the shared gate.** Replace the local `UUID_RE` + `supabaseConfigured()` definition with a re-export so there is one source of truth (the existing `repo-factory.test.ts` imports `supabaseConfigured` from `@/lib/repo` and keeps passing):

Remove the `UUID_RE` const and the `export function supabaseConfigured() {...}` body from `repo.ts`, and add near the top (after the `@valor/core` import):

```ts
import { supabaseConfigured } from './supabase/config';
export { supabaseConfigured };
```

(Leave `createRepo()`/`getRepo()` using `supabaseConfigured()` as before.)

- [ ] **Step 5: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/web test -- "auth-config|repo-factory"` → PASS. `corepack pnpm --filter @valor/web typecheck` → 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/supabase/config.ts apps/web/lib/repo.ts apps/web/__tests__/auth-config.test.ts
git commit -m "feat(web): lightweight supabaseConfigured + decideAuth (middleware-safe auth gate)"
```

---

### Task 2: `@supabase/ssr` + browser & server clients

**Files:**
- Modify: `apps/web/package.json` (+ root lockfile)
- Create: `apps/web/lib/supabase/browser.ts`, `apps/web/lib/supabase/server.ts`
- Test: `apps/web/__tests__/supabase-clients.test.ts`

- [ ] **Step 1: Install the pinned dep**

Run (repo root): `corepack pnpm --filter @valor/web add @supabase/ssr@0.12.0` (exact pin). Confirm `apps/web/package.json` shows `"@supabase/ssr": "0.12.0"` and the lockfile updated.

- [ ] **Step 2: Write the failing test** — `apps/web/__tests__/supabase-clients.test.ts` (mock `@supabase/ssr` so no bundler-only resolution):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createBrowserClient = vi.fn(() => ({ tag: 'browser' }));
const createServerClient = vi.fn(() => ({ tag: 'server' }));
vi.mock('@supabase/ssr', () => ({ createBrowserClient, createServerClient }));

const cookieStore = { getAll: () => [{ name: 'sb', value: '1' }], set: vi.fn() };
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

beforeEach(() => {
  createBrowserClient.mockClear();
  createServerClient.mockClear();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
});

it('createSupabaseBrowserClient passes url + anon key to createBrowserClient', async () => {
  const { createSupabaseBrowserClient } = await import('@/lib/supabase/browser');
  const c = createSupabaseBrowserClient();
  expect(c).toEqual({ tag: 'browser' });
  expect(createBrowserClient).toHaveBeenCalledWith('https://x.supabase.co', 'anon-key');
});

it('createSupabaseServerClient wires the cookie adapter', async () => {
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const c = await createSupabaseServerClient();
  expect(c).toEqual({ tag: 'server' });
  const [url, key, opts] = createServerClient.mock.calls[0];
  expect(url).toBe('https://x.supabase.co');
  expect(key).toBe('anon-key');
  expect(opts.cookies.getAll()).toEqual([{ name: 'sb', value: '1' }]);
});
```

- [ ] **Step 3: Run, verify fail** → cannot resolve `@/lib/supabase/browser`.

- [ ] **Step 4: Create `apps/web/lib/supabase/browser.ts`**

```ts
import { createBrowserClient } from '@supabase/ssr';

// Memoized per browser tab. Client components only.
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    );
  }
  return client;
}
```

- [ ] **Step 5: Create `apps/web/lib/supabase/server.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server components only. Next 15: cookies() is async.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // From a Server Component the cookie store is read-only — middleware
          // refreshes the session cookie instead, so swallow the write.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            /* read-only in a Server Component render */
          }
        },
      },
    },
  );
}
```

- [ ] **Step 6: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/web test -- supabase-clients` → PASS (2). `corepack pnpm --filter @valor/web typecheck` → 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json ../../pnpm-lock.yaml apps/web/lib/supabase/browser.ts apps/web/lib/supabase/server.ts apps/web/__tests__/supabase-clients.test.ts
git commit -m "feat(web): @supabase/ssr browser + server clients (pinned 0.12.0)"
```

---

### Task 3: `lib/auth.ts` — sign-in/out + `useSession` (TDD)

**Files:**
- Create: `apps/web/lib/auth.ts`
- Test: `apps/web/__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing test** — `apps/web/__tests__/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const signInWithOAuth = vi.fn(async () => ({ error: null }));
const signOutFn = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOAuth, signOut: signOutFn } }),
}));

beforeEach(() => { signInWithOAuth.mockClear(); signOutFn.mockClear(); });

it('signInWithMicrosoft requests the azure provider with the callback redirect', async () => {
  const { signInWithMicrosoft } = await import('@/lib/auth');
  await signInWithMicrosoft('/tickets');
  const arg = signInWithOAuth.mock.calls[0][0];
  expect(arg.provider).toBe('azure');
  expect(arg.options.redirectTo).toMatch(/\/auth\/callback\?next=%2Ftickets$/);
});

it('signOut calls supabase auth.signOut', async () => {
  const { signOut } = await import('@/lib/auth');
  await signOut();
  expect(signOutFn).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, verify fail** → cannot resolve `@/lib/auth`.

- [ ] **Step 3: Create `apps/web/lib/auth.ts`**

```ts
'use client';

import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/** Start the Microsoft/Entra OAuth flow; returns to /auth/callback then `next`. */
export async function signInWithMicrosoft(next = '/') {
  const supabase = createSupabaseBrowserClient();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
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
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (active) setSession(s);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
```

- [ ] **Step 4: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/web test -- "auth.test"` → PASS (2). Typecheck → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth.ts apps/web/__tests__/auth.test.ts
git commit -m "feat(web): auth helpers — signInWithMicrosoft / signOut / useSession"
```

---

### Task 4: `/auth/callback` page (TDD)

**Files:**
- Create: `apps/web/app/auth/callback/page.tsx`
- Test: `apps/web/__tests__/auth-callback.test.tsx`

- [ ] **Step 1: Write the failing test** — `apps/web/__tests__/auth-callback.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), useSearchParams: () => new URLSearchParams('next=/tickets') }));

const exchangeCodeForSession = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { exchangeCodeForSession } }),
}));

import CallbackPage from '@/app/auth/callback/page';

beforeEach(() => { replace.mockClear(); exchangeCodeForSession.mockReset(); });

it('exchanges the code and redirects to next on success', async () => {
  exchangeCodeForSession.mockResolvedValue({ error: null });
  render(<CallbackPage />);
  await waitFor(() => expect(exchangeCodeForSession).toHaveBeenCalled());
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/tickets'));
});

it('shows an error and does not redirect on failure', async () => {
  exchangeCodeForSession.mockResolvedValue({ error: { message: 'bad code' } });
  render(<CallbackPage />);
  await waitFor(() => expect(screen.getByText(/couldn’t complete sign-in/i)).toBeInTheDocument());
  expect(replace).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, verify fail** → cannot resolve `@/app/auth/callback/page`.

- [ ] **Step 3: Create `apps/web/app/auth/callback/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Client-side OAuth code exchange (PKCE). A page (not a route handler) so the
 * static-export build still succeeds. On success → redirect to `next`; on
 * failure → an error with a link back to sign in.
 */
export default function CallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .exchangeCodeForSession(window.location.href)
      .then(({ error: err }) => {
        if (err) { setError(true); return; }
        router.replace(params.get('next') || '/');
      })
      .catch(() => setError(true));
  }, [router, params]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass-strong w-full max-w-md rounded-xl px-8 py-10 text-center">
        {error ? (
          <>
            <h1 className="font-display text-xl text-cream">We couldn’t complete sign-in</h1>
            <p className="mt-2 text-sm text-muted-foreground">The sign-in link may have expired.</p>
            <a href="/login" className="mt-5 inline-block font-mono text-[0.75rem] uppercase tracking-wider text-gold-light hover:text-cream">
              Back to sign in
            </a>
          </>
        ) : (
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Signing you in…</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/web test -- auth-callback` → PASS (2). Typecheck → 0. (If the apostrophe in the assertion is brittle in jsdom, match `/couldn/i` instead — keep it honest.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/auth/callback/page.tsx apps/web/__tests__/auth-callback.test.tsx
git commit -m "feat(web): /auth/callback — client-side PKCE code exchange (static-export safe)"
```

---

### Task 5: Rework `/login` (TDD)

**Files:**
- Modify: `apps/web/app/login/page.tsx`
- Test: `apps/web/__tests__/login.test.tsx`

- [ ] **Step 1: Write the failing test** — `apps/web/__tests__/login.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const signInWithMicrosoft = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/auth', () => ({ signInWithMicrosoft }));
const supabaseConfigured = vi.fn(() => true);
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import LoginPage from '@/app/login/page';

beforeEach(() => { signInWithMicrosoft.mockClear(); supabaseConfigured.mockReturnValue(true); });

it('shows the Microsoft button and starts SSO on click when configured', () => {
  render(<LoginPage />);
  const btn = screen.getByRole('button', { name: /sign in with microsoft/i });
  fireEvent.click(btn);
  expect(signInWithMicrosoft).toHaveBeenCalled();
});

it('shows the demo affordance when Supabase is not configured', () => {
  supabaseConfigured.mockReturnValue(false);
  render(<LoginPage />);
  expect(screen.getByRole('button', { name: /continue \(demo mode\)/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /sign in with microsoft/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run, verify fail** → no Microsoft button (current page is the password form).

- [ ] **Step 3: Replace `apps/web/app/login/page.tsx`**

```tsx
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
              Demo mode — Supabase isn’t configured, so this opens the walkthrough with sample data only.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/web test -- "login.test"` → PASS (2). Typecheck → 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/login/page.tsx apps/web/__tests__/login.test.tsx
git commit -m "feat(web): login — Microsoft SSO when configured, demo mode when not"
```

---

### Task 6: `NotProvisioned` + `RequireMembership` + hub layout (TDD)

**Files:**
- Create: `apps/web/components/not-provisioned.tsx`, `apps/web/components/require-membership.tsx`
- Test: `apps/web/__tests__/require-membership.test.tsx`
- Modify: `apps/web/app/(hub)/layout.tsx`

- [ ] **Step 1: Write the failing test** — `apps/web/__tests__/require-membership.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const supabaseConfigured = vi.fn(() => true);
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));
vi.mock('@/lib/auth', () => ({ signOut: vi.fn() }));

let membershipRows: unknown[] = [];
let session: unknown = { user: { id: 'u1' } };
const limit = vi.fn(async () => ({ data: membershipRows, error: null }));
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: async () => ({ data: { session } }) },
    from: () => ({ select: () => ({ eq: () => ({ limit }) }) }),
  }),
}));

import { RequireMembership } from '@/components/require-membership';

beforeEach(() => { supabaseConfigured.mockReturnValue(true); membershipRows = []; session = { user: { id: 'u1' } }; process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = '00000000-0000-0000-0000-000000000001'; });

it('passes children through when unconfigured (mock mode)', () => {
  supabaseConfigured.mockReturnValue(false);
  render(<RequireMembership><div>app</div></RequireMembership>);
  expect(screen.getByText('app')).toBeInTheDocument();
});

it('renders children when the user has a membership in the active org', async () => {
  membershipRows = [{ org_id: '00000000-0000-0000-0000-000000000001' }];
  render(<RequireMembership><div>app</div></RequireMembership>);
  await waitFor(() => expect(screen.getByText('app')).toBeInTheDocument());
});

it('renders NotProvisioned when the user has no membership', async () => {
  membershipRows = [];
  render(<RequireMembership><div>app</div></RequireMembership>);
  await waitFor(() => expect(screen.getByText(/access not provisioned/i)).toBeInTheDocument());
  expect(screen.queryByText('app')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run, verify fail** → cannot resolve `@/components/require-membership`.

- [ ] **Step 3: Create `apps/web/components/not-provisioned.tsx`**

```tsx
'use client';

import { signOut } from '@/lib/auth';

/** Signed in, but no membership in the active org — an explicit state, not a broken app. */
export function NotProvisioned() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="glass-strong w-full max-w-md rounded-xl px-8 py-10 text-center">
        <div className="eyebrow mb-2">Access not provisioned</div>
        <h1 className="font-display text-xl text-cream">You’re signed in, but not a member of this workspace yet</h1>
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
```

- [ ] **Step 4: Create `apps/web/components/require-membership.tsx`**

```tsx
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
      const { data } = await supabase.from('memberships').select('org_id').eq('org_id', orgId).limit(1);
      if (active) setState((data?.length ?? 0) > 0 ? 'ok' : 'denied');
    })();
    return () => { active = false; };
  }, []);

  if (state === 'checking') return null;
  if (state === 'denied') return <NotProvisioned />;
  return <>{children}</>;
}
```

- [ ] **Step 5: Wire into `apps/web/app/(hub)/layout.tsx`.** Import `RequireMembership` and wrap the page content (inside `RoleGate`), and switch the data fetch to `getServerRepo()` (the import swap is finalized in Task 7; for now add the wrapper):

Change the import line `import { getRepo, DEMO_ORG_ID } from '@/lib/repo';` → `import { getServerRepo, DEMO_ORG_ID } from '@/lib/repo';`, the fetch `const tree = await getRepo().getAssetTree(DEMO_ORG_ID);` → `const tree = await (await getServerRepo()).getAssetTree(DEMO_ORG_ID);`, add `import { RequireMembership } from '@/components/require-membership';`, and wrap:

```tsx
  const shell = (
    <AppShell tree={tree}>
      <RequireMembership>
        <RoleGate>{children}</RoleGate>
      </RequireMembership>
    </AppShell>
  );
```

(`getServerRepo` is created in Task 7; this layout will not typecheck until then — that's fine within the task sequence, but to keep each task green, do Task 7 before re-running the full typecheck. Run only the component test in Step 6.)

- [ ] **Step 6: Run the component test, verify pass**

Run: `corepack pnpm --filter @valor/web test -- require-membership` → PASS (3).

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/not-provisioned.tsx apps/web/components/require-membership.tsx apps/web/app/(hub)/layout.tsx apps/web/__tests__/require-membership.test.tsx
git commit -m "feat(web): not-provisioned state + RequireMembership gate in the hub layout"
```

---

### Task 7: `repo.ts` hybrid (`getServerRepo`) + switch server call sites

**Files:**
- Modify: `apps/web/lib/repo.ts`
- Modify (server call sites): `apps/web/app/(hub)/assets/page.tsx`, `apps/web/app/(hub)/jobs/page.tsx`, `apps/web/app/(hub)/wells/[wellId]/page.tsx`, `apps/web/app/(hub)/wells/[wellId]/setup/page.tsx` (`app/(hub)/layout.tsx` already switched in Task 6)

- [ ] **Step 1: Update `apps/web/lib/repo.ts`** — `getRepo()` uses the browser client; add async `getServerRepo()` using the server client. Replace the configured `createClient(...)` construction:

In `createRepo()` (the client path), swap the lazy `@supabase/supabase-js` `createClient` for the browser client:

```ts
function createRepo(): Repository {
  if (supabaseConfigured()) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createSupabaseBrowserClient } = require('./supabase/browser') as typeof import('./supabase/browser');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SupabaseRepository } = require('./supabase-repository') as typeof import('./supabase-repository');
    const orgId = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID as string;
    return new SupabaseRepository(createSupabaseBrowserClient(), orgId);
  }
  return new MockRepository();
}
```

Add the server factory (separate instance — server context, per-request cookies):

```ts
/** Server-component data layer: builds a SupabaseRepository over the request's
 *  session (cookies via next/headers) when configured; else the mock. */
export async function getServerRepo(): Promise<Repository> {
  if (supabaseConfigured()) {
    const { createSupabaseServerClient } = await import('./supabase/server');
    const { SupabaseRepository } = await import('./supabase-repository');
    const orgId = process.env.NEXT_PUBLIC_SUPABASE_ORG_ID as string;
    return new SupabaseRepository(await createSupabaseServerClient(), orgId);
  }
  return new MockRepository();
}
```

(Keep `getRepo()`, `supabaseConfigured` re-export, and `DEMO_ORG_ID` export as-is. The server path uses `await import` — fine in an async server function.)

- [ ] **Step 2: Extend `apps/web/__tests__/repo-factory.test.ts`** with the server-factory mock-default case (append inside the describe):

```ts
  it('getServerRepo() returns MockRepository when unconfigured', async () => {
    vi.resetModules();
    const { getServerRepo } = await import('@/lib/repo');
    const repo = await getServerRepo();
    expect(repo.constructor.name).toBe('MockRepository');
  });
```

- [ ] **Step 3: Switch the 4 remaining server call sites** from `await getRepo()` to `await (await getServerRepo())`, updating the import in each file (`getRepo` → `getServerRepo`):
  - `app/(hub)/assets/page.tsx`: `const tree = await (await getServerRepo()).getAssetTree(DEMO_ORG_ID);`
  - `app/(hub)/jobs/page.tsx`: replace the `await getRepo().<call>` with `await (await getServerRepo()).<call>` (same method/args).
  - `app/(hub)/wells/[wellId]/page.tsx`: `const wells = await (await getServerRepo()).listWells(DEMO_ORG_ID);` (the page body; its `generateStaticParams` is handled in Task 8).
  - `app/(hub)/wells/[wellId]/setup/page.tsx`: same `getRepo` → `getServerRepo` swap on the server fetch.

- [ ] **Step 4: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/web test -- repo-factory` → PASS. `corepack pnpm --filter @valor/web typecheck` → 0 (the Task 6 layout now resolves `getServerRepo`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/repo.ts apps/web/__tests__/repo-factory.test.ts "apps/web/app/(hub)/assets/page.tsx" "apps/web/app/(hub)/jobs/page.tsx" "apps/web/app/(hub)/wells/[wellId]/page.tsx" "apps/web/app/(hub)/wells/[wellId]/setup/page.tsx"
git commit -m "feat(web): getServerRepo (server session client) + switch server call sites"
```

---

### Task 8: `generateStaticParams` gating (TDD)

**Files:**
- Create: `apps/web/lib/static-params.ts`
- Test: `apps/web/__tests__/static-params.test.ts`
- Modify: `app/(hub)/tickets/[ticketId]/page.tsx`, `app/(hub)/wells/[wellId]/page.tsx`, `app/(hub)/wells/[wellId]/setup/page.tsx`

- [ ] **Step 1: Write the failing test** — `apps/web/__tests__/static-params.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const supabaseConfigured = vi.fn(() => false);
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));

import { staticParamsFor } from '@/lib/static-params';

beforeEach(() => supabaseConfigured.mockReturnValue(false));

it('enumerates the given params when unconfigured (static export / mock)', () => {
  expect(staticParamsFor([{ ticketId: 'a' }, { ticketId: 'b' }])).toEqual([{ ticketId: 'a' }, { ticketId: 'b' }]);
});

it('returns [] when configured (route renders dynamically per request)', () => {
  supabaseConfigured.mockReturnValue(true);
  expect(staticParamsFor([{ ticketId: 'a' }])).toEqual([]);
});
```

- [ ] **Step 2: Run, verify fail** → cannot resolve `@/lib/static-params`.

- [ ] **Step 3: Create `apps/web/lib/static-params.ts`**

```ts
import { supabaseConfigured } from '@/lib/supabase/config';

/**
 * Gate build-time `generateStaticParams`: when Supabase is configured there is no
 * session at build, so we cannot (and must not) enumerate per-org ids — return []
 * and let the route render dynamically per request. In mock / static-export mode
 * (unconfigured) enumerate as before so the static export is complete.
 */
export function staticParamsFor<T>(params: T[]): T[] {
  return supabaseConfigured() ? [] : params;
}
```

- [ ] **Step 4: Apply to the 3 routes.** In each `generateStaticParams`, add an early `if (supabaseConfigured()) return [];` guard (so the configured build never makes a build-time repo call, and the route renders dynamically per request), keep the existing enumeration for the mock/export path, and pass its result through `staticParamsFor(...)`. Add imports `supabaseConfigured` from `@/lib/supabase/config` and `staticParamsFor` from `@/lib/static-params`. Concrete form (e.g. `app/(hub)/wells/[wellId]/page.tsx`):

```ts
export async function generateStaticParams() {
  if (supabaseConfigured()) return [];                 // configured: render dynamically
  const wells = await (await getServerRepo()).listWells(DEMO_ORG_ID); // mock here
  return staticParamsFor(wells.map((w) => ({ wellId: w.id })));
}
```

For `tickets/[ticketId]/page.tsx` and `wells/[wellId]/setup/page.tsx`, apply the identical pattern, keeping each route's existing enumeration method/args and mapping to its own param shape (`{ ticketId }` / `{ wellId }`). The `staticParamsFor(...)` wrap is belt-and-suspenders given the guard, and documents intent.

- [ ] **Step 5: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/web test -- static-params` → PASS (2). Typecheck → 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/static-params.ts apps/web/__tests__/static-params.test.ts "apps/web/app/(hub)/tickets/[ticketId]/page.tsx" "apps/web/app/(hub)/wells/[wellId]/page.tsx" "apps/web/app/(hub)/wells/[wellId]/setup/page.tsx"
git commit -m "feat(web): gate generateStaticParams — [] when configured, enumerate in mock/export"
```

---

### Task 9: Rewrite `middleware.ts`

**Files:**
- Create: `apps/web/lib/supabase/middleware-client.ts`
- Modify: `apps/web/middleware.ts`

(No unit test for the edge middleware itself — `decideAuth` is already tested in Task 1 and `updateSession` calls the bundler-only client; covered by the builds in Task 10.)

- [ ] **Step 1: Create `apps/web/lib/supabase/middleware-client.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Refresh the Supabase session for this request and return the user (or null). */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; user: unknown }> {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  return { response, user: data.user };
}
```

- [ ] **Step 2: Replace `apps/web/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfigured, decideAuth } from '@/lib/supabase/config';
import { updateSession } from '@/lib/supabase/middleware-client';

/**
 * Real auth gate (configured) / open demo (unconfigured). When Supabase is
 * configured, refresh the session each request and redirect unauthenticated
 * users (except on the public sign-in paths) to /login. When NOT configured the
 * app is the open mock demo — pass everything through. (Static export ignores
 * middleware entirely.)
 */
export async function middleware(request: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.next();

  const { response, user } = await updateSession(request);
  if (decideAuth(true, Boolean(user), request.nextUrl.pathname) === 'redirect') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

(Note: `/login` and `/auth/callback` are now reachable because `decideAuth` treats them as public — they no longer need to be excluded by the matcher.)

- [ ] **Step 3: Typecheck, verify pass**

Run: `corepack pnpm --filter @valor/web typecheck` → 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/supabase/middleware-client.ts apps/web/middleware.ts
git commit -m "feat(web): middleware — session refresh + auth gate (open demo when unconfigured)"
```

---

### Task 10: Verify — suites, both typechecks, both builds

- [ ] **Step 1:** Full web suite + core suite green:
  - `corepack pnpm --filter @valor/web test` → all pass.
  - `corepack pnpm --filter @valor/core test` → all pass (unchanged).
- [ ] **Step 2:** Typechecks: `corepack pnpm --filter @valor/web typecheck` → 0; `corepack pnpm --filter @valor/core typecheck` → 0.
- [ ] **Step 3:** Normal build → `corepack pnpm --filter @valor/web build` → exit 0. The `/auth/callback` page compiles; middleware listed.
- [ ] **Step 4:** Static export → `STATIC_EXPORT=true corepack pnpm --filter @valor/web build` → exit 0; same page count as before H1 (the callback page is the only new route; confirm it exports as static). Clear env after.
- [ ] **Step 5:** If anything fails, fix and re-run before proceeding. Commit any fixups.

---

### Task 11: Live SSO verification (manual — needs the Prerequisites) + PR

- [ ] **Step 1:** Push branch; open PR (title: "feat: Supabase Auth H1 — Microsoft SSO + session-aware data layer (auth foundation)"). PR body documents the manual Prerequisites + the manual E2E below. Standard dual-bot review loop; address findings.
- [ ] **Step 2 (manual, after Prerequisites done):** With `apps/web/.env.local` set (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ORG_ID=00000000-0000-0000-0000-000000000001`), run `corepack pnpm --filter @valor/web dev`:
  - Visiting any route → redirected to `/login`.
  - "Sign in with Microsoft" → Entra → `/auth/callback` → app.
  - Before seeding the membership → `<NotProvisioned/>`. After seeding (Prereq 3) + re-sign-in → the app loads org A's data (RLS-served).
  - Sign out → back to `/login`.
- [ ] **Step 3:** Merge once green + reviewed.

---

## Self-Review

**1. Spec coverage:** Microsoft SSO (`signInWithMicrosoft`, Task 3; login button, Task 5) ✓. Hybrid `@supabase/ssr` — browser (Task 2) + server (Task 2) clients, `getRepo()`/`getServerRepo()` (Task 7) ✓. `/auth/callback` `'use client'` page (Task 4) ✓. Middleware session-refresh + configured-gated `decideAuth` (Tasks 1, 9) ✓. `repo.ts` off the anon singleton (Task 7) ✓. Not-provisioned + `RequireMembership` (Task 6) ✓. 6 server call sites switched (Tasks 6, 7) ✓. `generateStaticParams` gating (Task 8) ✓. Both builds (Task 10) ✓. Mock-mode/demo preserved (Tasks 5, 9) ✓. Prerequisites + manual E2E (Task 11) ✓. Security: anon-only `NEXT_PUBLIC` (Task 2 uses anon key), authz via `memberships` not `user_metadata` (Task 6) ✓. Pinned `@supabase/ssr` + lockfile (Task 2) ✓.

**2. Placeholder scan:** Task 8 Step 4 shows a transitional sketch then the concrete `if (supabaseConfigured()) return []` guard + `staticParamsFor(...)` — the concrete form is the one to implement (the sketch is labeled "replaced below"). No other placeholders; all code blocks complete.

**3. Type consistency:** `supabaseConfigured()` (config.ts) re-exported by repo.ts — one definition, both import sites consistent. `createSupabaseBrowserClient()` / `createSupabaseServerClient()` names match across browser.ts/server.ts, auth.ts, require-membership.tsx, repo.ts, middleware-client.ts. `getServerRepo()` returns `Promise<Repository>` and every call site does `await (await getServerRepo())`. `decideAuth(configured, hasSession, pathname)` signature matches Task 1 ↔ Task 9. `staticParamsFor<T>(params)` matches Task 8 usages. `signInWithMicrosoft(next?)` / `signOut()` match login + not-provisioned usages.
