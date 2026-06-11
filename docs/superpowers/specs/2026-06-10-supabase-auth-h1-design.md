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
3. **Architecture: hybrid `@supabase/ssr`** (the standard Next App Router pattern). The app is a mix of client and server components: ~6 components fetch via `getRepo()` **server-side** (hub `layout.tsx` + `assets`/`jobs`/`wells/[id]`/`wells/[id]/setup` pages), 3 dynamic routes use **`generateStaticParams`** (build-time), and the rest fetch in `'use client'` components. So a single browser (cookie) client is insufficient. H1 adds **both** a browser client (client components) and a server client (server components, cookies via `next/headers`), splits the factory into `getRepo()` (client) + `getServerRepo()` (async, server), uses a `'use client'` `/auth/callback` page (not a route handler — static export still builds) and middleware for session refresh + gating that no-ops when Supabase is unconfigured. RLS works via the user's JWT in both contexts; both build targets stay green.

## Prerequisites (external — user/Entra-admin provided)

These gate live end-to-end testing, not the code:

1. **Azure AD (Entra) app registration** — redirect URI `https://ekswyggelycioeupgfil.supabase.co/auth/v1/callback`; produces a client ID + client secret. Tenant `jtech.ai` (single-tenant recommended).
2. **Enable the Azure provider in Supabase Auth** with that client ID/secret + tenant URL (`https://login.microsoftonline.com/<tenant-id>`); add the app origins' `/auth/callback` and `http://localhost:3000/auth/callback` to the redirect allowlist; set the Site URL.
3. **Seed the first membership** — after `b.jones@jtech.ai` signs in once (creating the `auth.users` row), attach an `owner` membership in org A via SQL (the Management-API path used for RLS validation).

## Architecture & Components

### New files
- **`apps/web/lib/supabase/browser.ts`** — `createSupabaseBrowserClient()` using `@supabase/ssr` `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` + anon key. Cookie-based session; memoized per browser. **Client components only.**
- **`apps/web/lib/supabase/server.ts`** — `createSupabaseServerClient()` (async) using `@supabase/ssr` `createServerClient` with the `next/headers` `cookies()` adapter (Next 15 `cookies()` is async). **Server components only.** Reads the request's session cookies so server-side queries run as the signed-in user.
- **`apps/web/lib/supabase/middleware-client.ts`** — `updateSession(request: NextRequest)` using `createServerClient` with the request/response cookie adapter; calls `getUser()` to refresh, returns `{ response, user }` for `middleware.ts`.
- **`apps/web/app/auth/callback/page.tsx`** — `'use client'`. On mount: `supabase.auth.exchangeCodeForSession(window.location.href)` (PKCE), then `router.replace(next ?? '/')`. Renders a "Signing you in…" state and an error state with a "Back to sign in" link. A **page, not a route handler**, so `output: 'export'` still builds.
- **`apps/web/lib/auth.ts`** — `signInWithMicrosoft(next?)` (`signInWithOAuth({ provider: 'azure', options: { redirectTo: <origin>/auth/callback?next=… , scopes: 'email' } })`), `signOut()`, and a `useSession()` hook (subscribes to `onAuthStateChange`, exposes `{ session, user, loading }`).
- **`apps/web/components/not-provisioned.tsx`** — the "signed in, but no membership in this org" state: brand card, explanatory copy, contact-admin note, sign-out button.

### Changed files
- **`apps/web/app/login/page.tsx`** — replace the password form with a "Sign in with Microsoft" button → `signInWithMicrosoft()`, keeping the existing brand/card styling. When Supabase is **unconfigured** (mock mode), render a "Continue (demo mode)" affordance that sets the existing demo cookie, so the static demo flow is preserved.
- **`apps/web/middleware.ts`** — new logic: if Supabase **unconfigured** → `NextResponse.next()` (open demo, unchanged behavior); else call `updateSession(request)` and, when there is no user and the path is not public (`/login`, `/auth/callback`, `/api`, `_next`/static, files), redirect to `/login`. Keep the matcher. Extract the pure branch decision into a testable helper `decideAuth(configured, hasSession, pathname)`.
- **`apps/web/lib/repo.ts`** — keep `getRepo(): Repository` (client/browser path): configured branch builds the `SupabaseRepository` over `createSupabaseBrowserClient()` (session-aware) instead of the plain anon `createClient`. **Add `getServerRepo(): Promise<Repository>`** (server path): configured branch builds the `SupabaseRepository` over `await createSupabaseServerClient()`; unconfigured → `MockRepository`. Both issue requests as the signed-in user → RLS serves their org. The gate (`supabaseConfigured()`: URL + anon key + UUID `ORG_ID`) is shared/unchanged; remove the "anon singleton / RLS returns no rows" limitation comment.
- **Six server-component call sites switch `await getRepo()` → `await getServerRepo()`:** `app/(hub)/layout.tsx`, `app/(hub)/assets/page.tsx`, `app/(hub)/jobs/page.tsx`, `app/(hub)/wells/[wellId]/page.tsx`, `app/(hub)/wells/[wellId]/setup/page.tsx`, and the `generateStaticParams` in `app/(hub)/tickets/[ticketId]/page.tsx`. (Client components keep `getRepo()`.)
- **`generateStaticParams` gating (3 routes:** `tickets/[ticketId]`, `wells/[wellId]`, `wells/[wellId]/setup`) — extract a small helper so each returns `[]` when `supabaseConfigured()` (can't/shouldn't enumerate per-user ids at build with no session → route renders dynamically per-request with the user's cookies), and enumerates from the repo otherwise (static export / mock). This keeps `STATIC_EXPORT=true` (mock, enumerates) and configured Vercel (dynamic) both correct.
- **Hub layout** (`apps/web/app/(hub)/layout.tsx`) — wrap children in a new thin **client** component `components/require-membership.tsx` (`<RequireMembership>`). When Supabase is configured and a session exists, it queries `memberships` self-select (RLS-allowed) for a row in `ORG_ID`; none → render `<NotProvisioned/>` instead of the app. In mock mode (or no session) it passes children through untouched. Keeping it a client component avoids putting the session/`memberships` query in the server-rendered layout.

## Data flow

**Configured (Vercel/dev):**
1. Unauthenticated request → middleware (no user) → redirect `/login`.
2. `/login` → "Sign in with Microsoft" → `signInWithOAuth({ provider: 'azure' })` → Microsoft sign-in → Supabase `/auth/v1/callback` → app `/auth/callback?code=…`.
3. `/auth/callback` (`'use client'`) → `exchangeCodeForSession` → session cookies set → `router.replace('/')`.
4. App pages → server components use `getServerRepo()` (server client, request cookies), client components use `getRepo()` (browser client) → both `SupabaseRepository` over a session client → queries carry the user JWT → RLS returns the user's org data. Middleware refreshes the session cookie each request so the server client sees a fresh session.
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
- `repo.ts` factory: keep the existing `supabaseConfigured()` gate tests (unchanged); add that `getServerRepo()` returns `MockRepository` when unconfigured. The **configured** construction (browser/server clients) is **not** unit-tested — it lazy-`require`s/imports the bundler-only `@supabase/ssr` and (server) `next/headers` cookies, which don't resolve under vitest; it is covered by typecheck + both builds, consistent with the existing test's rationale.
- `<NotProvisioned/>`: renders the state + signs out on click.
- `<RequireMembership/>`: passes children through in mock mode / no session; with a session, queries `memberships` (mock the browser client) → renders children when a row in `ORG_ID` exists, `<NotProvisioned/>` when not.
- `decideAuth(configured, hasSession, pathname)`: configured + no session + protected → redirect; unconfigured → pass; public paths → pass.
- `staticParamsFor(...)` gating helper: returns `[]` when configured; enumerates the given ids otherwise.

**Builds:** both typechecks 0; normal build **and** `STATIC_EXPORT=true` exit 0 (the callback page + middleware must not break export) — the same gate G2 passed. Build-config assumption: the `STATIC_EXPORT=true` build runs **without** Supabase env (mock → `generateStaticParams` enumerates → full static export); the configured build runs on Vercel (server runtime → the 3 dynamic routes render per-request). These two modes are mutually exclusive by deploy config.

**Manual E2E (documented; needs the live Azure provider):** real Microsoft sign-in end-to-end on a preview deploy → RLS-served data; a no-membership account → `<NotProvisioned/>`. SSO cannot be unit-tested without the live provider, so the plan documents this manual pass as the end-to-end gate.

## Non-goals (H1)

- Org switcher / multi-org — **H2**; H1 stays single env `ORG_ID`.
- In-app user/membership management — **H3**; provisioning stays SQL.
- Self-serve sign-up — admin-provisioned only (matches the admin-gated membership model).
- Moving data fetching to server components — stays client-side (Approach A).
