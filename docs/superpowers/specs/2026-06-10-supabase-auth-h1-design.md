# Supabase Auth — Slice H1 (Auth Foundation) Design

**Status:** Approved (brainstorm 2026-06-10). Spec for implementation planning.

**One-liner:** Replace the demo `/login` + cookie-presence middleware with real Microsoft/Entra SSO so a signed-in user's session JWT flows to Supabase and RLS serves their org's data — keeping both build targets green and mock mode as the open demo.

---

## Context

The Supabase backend is live and proven: schema + RLS applied to project **vep-1** (`ekswyggelycioeupgfil`) and validated 4/4 against the real PostgREST + user-JWT path (read isolation, org visibility, write isolation, privilege-escalation guard). A demo org **A** (`00000000-0000-0000-0000-000000000001`, "Valor (demo)") with an `owner` membership and sample `Asset A / Pad A / Well A-1` is seeded.

The web app does not yet *use* this. Today:
- `apps/web/app/login/page.tsx` is a demo placeholder — a hard-coded client-side password (`valor1!`) that sets an unsigned `valor_demo_auth` cookie.
- `apps/web/middleware.ts` gates every route on the *presence* of that cookie (no real verification).
- `apps/web/lib/repo.ts` is env-gated: with `NEXT_PUBLIC_SUPABASE_{URL,ANON_KEY,ORG_ID}` set it builds a `SupabaseRepository`, but over a **plain anon-key singleton with no session** — so queries run as `anon` and RLS (all `TO authenticated`) returns nothing. Default (unconfigured) is `MockRepository`, and the running app is byte-for-byte unchanged.
- `@supabase/ssr` is not installed.

**Build targets (a hard constraint).** The repo maintains two builds: the Vercel server runtime (the real `operations.valorenp.com` deploy) and a `STATIC_EXPORT=true` static export (verified green through G2). Static export cannot run server route handlers and ignores middleware. This drives the architecture below.

## Decisions (from brainstorming)

1. **Auth method: Microsoft / Entra SSO** (`signInWithOAuth({ provider: 'azure' })`) — aligns with the O365/Teams horizon. (Not email/password; the seeded email/password demo user is not the SSO path.)
2. **Scope: the full account system, decomposed into three sequenced slices.** This spec is **H1 only**:
   - **H1 — Auth foundation** (this spec): SSO sign-in/out, callback, session, route gating, session-aware data layer, "not provisioned" state.
   - **H2 — Active-org context + switcher** (later): memberships → active org, replacing the single env `ORG_ID`.
   - **H3 — Admin provisioning UI** (later): invite/allowlist users, manage memberships/roles in-app (replacing SQL seeding).
3. **Architecture: client-side `@supabase/ssr`** — `createBrowserClient` (cookie session), a `'use client'` `/auth/callback` page (not a server route handler, so static export still builds), middleware for session refresh + gating that is a no-op when Supabase is unconfigured, and `repo.ts` switched to the session-aware browser client. Minimal refactor of the all-`'use client'` app; RLS works via the user's JWT; both build targets stay green.

## Prerequisites (external — user/Entra-admin provided)

These gate live end-to-end testing, not the code:

1. **Azure AD (Entra) app registration** — redirect URI `https://ekswyggelycioeupgfil.supabase.co/auth/v1/callback`; produces a client ID + client secret. Tenant `jtech.ai` (single-tenant recommended).
2. **Enable the Azure provider in Supabase Auth** with that client ID/secret + tenant URL (`https://login.microsoftonline.com/<tenant-id>`); add the app origins' `/auth/callback` and `http://localhost:3000/auth/callback` to the redirect allowlist; set the Site URL.
3. **Seed the first membership** — after `b.jones@jtech.ai` signs in once (creating the `auth.users` row), attach an `owner` membership in org A via SQL (the Management-API path used for RLS validation).

## Architecture & Components

### New files
- **`apps/web/lib/supabase/browser.ts`** — `createSupabaseBrowserClient()` using `@supabase/ssr` `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` + anon key. Cookie-based session; memoized per browser.
- **`apps/web/lib/supabase/middleware-client.ts`** — `updateSession(request: NextRequest)` using `createServerClient` with the request/response cookie adapter; calls `getUser()` to refresh, returns `{ response, user }` for `middleware.ts`.
- **`apps/web/app/auth/callback/page.tsx`** — `'use client'`. On mount: `supabase.auth.exchangeCodeForSession(window.location.href)` (PKCE), then `router.replace(next ?? '/')`. Renders a "Signing you in…" state and an error state with a "Back to sign in" link. A **page, not a route handler**, so `output: 'export'` still builds.
- **`apps/web/lib/auth.ts`** — `signInWithMicrosoft(next?)` (`signInWithOAuth({ provider: 'azure', options: { redirectTo: <origin>/auth/callback?next=… , scopes: 'email' } })`), `signOut()`, and a `useSession()` hook (subscribes to `onAuthStateChange`, exposes `{ session, user, loading }`).
- **`apps/web/components/not-provisioned.tsx`** — the "signed in, but no membership in this org" state: brand card, explanatory copy, contact-admin note, sign-out button.

### Changed files
- **`apps/web/app/login/page.tsx`** — replace the password form with a "Sign in with Microsoft" button → `signInWithMicrosoft()`, keeping the existing brand/card styling. When Supabase is **unconfigured** (mock mode), render a "Continue (demo mode)" affordance that sets the existing demo cookie, so the static demo flow is preserved.
- **`apps/web/middleware.ts`** — new logic: if Supabase **unconfigured** → `NextResponse.next()` (open demo, unchanged behavior); else call `updateSession(request)` and, when there is no user and the path is not public (`/login`, `/auth/callback`, `/api`, `_next`/static, files), redirect to `/login`. Keep the matcher. Extract the pure branch decision into a testable helper `decideAuth(configured, hasSession, pathname)`.
- **`apps/web/lib/repo.ts`** — in the configured branch, construct the client via `createSupabaseBrowserClient()` (session-aware) instead of the plain anon `createClient`. The `SupabaseRepository` then issues every request as the signed-in user, so RLS serves their org. The gate (URL + anon key + UUID `ORG_ID`) is unchanged; remove the "anon singleton / RLS returns no rows" limitation comment.
- **Hub layout** (`apps/web/app/(hub)/layout.tsx`) — wrap children in a new thin **client** component `components/require-membership.tsx` (`<RequireMembership>`). When Supabase is configured and a session exists, it queries `memberships` self-select (RLS-allowed) for a row in `ORG_ID`; none → render `<NotProvisioned/>` instead of the app. In mock mode (or no session) it passes children through untouched. Keeping it a client component avoids putting the session/`memberships` query in the server-rendered layout.

## Data flow

**Configured (Vercel/dev):**
1. Unauthenticated request → middleware (no user) → redirect `/login`.
2. `/login` → "Sign in with Microsoft" → `signInWithOAuth({ provider: 'azure' })` → Microsoft sign-in → Supabase `/auth/v1/callback` → app `/auth/callback?code=…`.
3. `/auth/callback` (`'use client'`) → `exchangeCodeForSession` → session cookies set → `router.replace('/')`.
4. App pages → `getRepo()` → `SupabaseRepository` over the session browser client → queries carry the user JWT → RLS returns the user's org data.
5. Provisioning guard: signed-in user with no membership in `ORG_ID` → `<NotProvisioned/>`.
6. Sign out → `supabase.auth.signOut()` → cookies cleared → middleware → `/login`.

**Mock mode (no Supabase env) / static export:** middleware no-ops (and is absent in static export); `/login` offers "Continue (demo mode)"; `getRepo()` → `MockRepository`. Behavior is today's open demo, unchanged.

## Error handling

- **Callback failure** (denied consent, expired/replayed code): `/auth/callback` renders an error + "Back to sign in" — never an infinite redirect.
- **Middleware refresh failure:** treat as unauthenticated (redirect `/login`), never 500.
- **`signInWithOAuth` error:** surfaced inline on `/login`.
- **Not-provisioned:** explicit `<NotProvisioned/>`; distinguished from "has membership, no data yet" (→ normal empty states).
- **Misconfiguration** (URL set, Azure provider not enabled): the OAuth call errors and is surfaced on `/login`; the app stays usable in whatever mode it is in.

## Security

- Only the anon/publishable key in `NEXT_PUBLIC_*` — **never** `service_role`. RLS is the boundary; middleware gating is defense-in-depth.
- Cookie-based sessions via `@supabase/ssr` (not `localStorage`); PKCE flow.
- **Authorization never reads `user_metadata`** (Microsoft-supplied, user-influenced). Access derives solely from the admin-gated `memberships` table — exactly what the proven RLS enforces.
- `@supabase/ssr` pinned to an exact version; lockfile committed (supply-chain).

## Testing

**Component/unit (Vitest/jsdom; mock the browser client):**
- `/login`: renders "Sign in with Microsoft" when configured and calls `signInWithMicrosoft` on click; renders the demo affordance when unconfigured.
- `/auth/callback`: calls `exchangeCodeForSession` on mount; redirects on success; error state on failure.
- `repo.ts` factory: extend the existing gate test — configured branch builds the session client (not plain anon); unconfigured → `MockRepository`.
- `<NotProvisioned/>`: renders the state + signs out on click.
- `decideAuth(configured, hasSession, pathname)`: configured + no session + protected → redirect; unconfigured → pass; public paths → pass.

**Builds:** both typechecks 0; normal build **and** `STATIC_EXPORT=true` exit 0 (the callback page + middleware must not break export) — the same gate G2 passed.

**Manual E2E (documented; needs the live Azure provider):** real Microsoft sign-in end-to-end on a preview deploy → RLS-served data; a no-membership account → `<NotProvisioned/>`. SSO cannot be unit-tested without the live provider, so the plan documents this manual pass as the end-to-end gate.

## Non-goals (H1)

- Org switcher / multi-org — **H2**; H1 stays single env `ORG_ID`.
- In-app user/membership management — **H3**; provisioning stays SQL.
- Self-serve sign-up — admin-provisioned only (matches the admin-gated membership model).
- Moving data fetching to server components — stays client-side (Approach A).
