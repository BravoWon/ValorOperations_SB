# Supabase Auth — Slice H2 (Active-org context + switcher) Design

**Status:** Approved (brainstorm 2026-06-11). Spec for implementation planning.

**One-liner:** Make the org the data layer scopes to **dynamic** — derived from the signed-in user's memberships and persisted in a `valor_active_org` cookie that both `getRepo` and `getServerRepo` read — instead of the static env `NEXT_PUBLIC_SUPABASE_ORG_ID`, with a switcher that appears only when a user belongs to more than one org.

---

## Context

Second of three auth slices: **H1** (Microsoft SSO + hybrid `@supabase/ssr` data layer) is merged; **H3** (admin provisioning UI) comes later. As built by H1:

- Data layer: `getRepo()` (browser client, client components) + `getServerRepo()` (server client via `next/headers`, server components). Both read `process.env.NEXT_PUBLIC_SUPABASE_ORG_ID` and construct `new SupabaseRepository(client, orgId)`.
- **`SupabaseRepository` scopes every query by its constructor `orgId` (`this.orgId`) and intentionally IGNORES the per-method `orgId` argument** (app callers pass `DEMO_ORG_ID`, which works for the mock and is discarded on the Supabase path). So the active org is exactly that constructor argument.
- `RequireMembership` (client) checks the user has a membership in the env `ORG_ID`, else renders `<NotProvisioned/>`. Wraps the hub content.
- `supabaseConfigured()` gates Supabase on URL + anon key + a valid-UUID `ORG_ID`. Mock mode (no env) = `MockRepository`, the open demo. Static export keeps a client `AuthGate` demo gate.
- RLS: `memberships_self_select` (a user reads their own membership rows) + `orgs_member_select` (a member reads their org row).
- There is an existing `RoleSwitcher` in the sidebar (`components/app-shell.tsx`) — the precedent to mirror for the org switcher.

**Near-term reality (decided):** users belong to **one org for now**. So H2 is minimal — derive the active org from membership, and the switcher only appears when someone genuinely has >1 org. Multi-org still works if seeded.

## Decisions (from brainstorming)

1. **Scope:** active-org context + switcher, single active org at a time, switcher shown only when >1 org. One spec/plan.
2. **Approach A — cookie-backed active org; env `ORG_ID` stays as gate + bootstrap default.** A `valor_active_org` cookie (server + client readable) holds the active org; `orgId = cookie ?? NEXT_PUBLIC_SUPABASE_ORG_ID`. `supabaseConfigured()` and mock mode are **unchanged**. (Rejected: B — pure membership-derivation, which forces a chicken-and-egg async data layer + a rewrite of H1's proven gate; C — org-in-URL routing, a massive refactor.)

## Architecture & Components

### The active-org cookie
- Name: `valor_active_org`; value: an org UUID. Attributes: `SameSite=Lax; path=/; max-age` ~1 year. **Not** httpOnly (the client must read it). It is an org *selection*, not a secret — RLS enforces real access.
- Read server-side via `next/headers` `cookies()`; client-side via `document.cookie`.

### New files
- **`apps/web/lib/active-org.ts`** — `export const ACTIVE_ORG_COOKIE = 'valor_active_org';` + `resolveActiveOrgClient(): string` (reads `document.cookie` for the cookie, falls back to `process.env.NEXT_PUBLIC_SUPABASE_ORG_ID`) + `readActiveOrgCookie(cookieValue: string | undefined): string` (pure helper: given a raw cookie value, return it or the env fallback — unit-testable, reused by both the client resolver and the server path). No `@supabase` imports (safe to import anywhere).
- **`apps/web/components/active-org-provider.tsx`** (client) — evolves H1's `RequireMembership`. On mount when configured + session: query the user's memberships joined to org names (`supabase.from('memberships').select('org_id, orgs(name)')`, RLS-allowed). Then:
  - **0 orgs → `<NotProvisioned/>`**.
  - **fetch error → an explicit retry state** ("Unable to verify access — please retry"), not `NotProvisioned`.
  - **≥1 org → validate** the active-org cookie is one of theirs. If absent/invalid, set the cookie to their **default org** (their single org; for >1, the cookie if valid else first by name) and `window.location.reload()` **once** (a ref guards against a reload loop). Otherwise expose `{ orgs, activeOrgId, setActiveOrg }` via React context.
  - **Unconfigured (mock) → pass children through** untouched (no orgs concept).
  - `setActiveOrg(orgId)`: validate `orgId` ∈ the user's orgs, write the cookie, `window.location.reload()`.
  - The React context object and the `useActiveOrg()` hook are **defined in and exported from this file** (`active-org-provider.tsx`) — no separate hook module.
- **`apps/web/components/org-switcher.tsx`** (client) — consumes `useActiveOrg()`: **>1 org → a dropdown** (mirror `RoleSwitcher`) of org names → `setActiveOrg`; **==1 → a static org-name label**; **mock / no context → renders nothing**.

### Changed files
- **`apps/web/lib/repo.ts`** — `getRepo()` configured branch: `const orgId = resolveActiveOrgClient();` (cookie ?? env) instead of reading the env var directly.
- **`apps/web/lib/server-repo.ts`** — `getServerRepo()` configured branch: read the cookie via `await cookies()` (already imported for the server client) and resolve `orgId = readActiveOrgCookie(cookie?.value)`.
- **`apps/web/app/(hub)/layout.tsx`** — replace `<RequireMembership>` with `<ActiveOrgProvider>` **wrapping `AppShell`** (so the not-provisioned gate replaces the whole shell and the sidebar switcher can read the context). Keep `RoleProvider` + the static-export `AuthGate` branch.
- **`apps/web/components/app-shell.tsx`** — render `<OrgSwitcher/>` in the sidebar (near `RoleSwitcher` / the footer org area).
- **Remove `apps/web/components/require-membership.tsx`** (+ its test) — superseded by `ActiveOrgProvider`, which subsumes the membership gate. `NotProvisioned` stays.

## Data flow (configured)

1. Request → `getServerRepo` resolves `orgId` from the `valor_active_org` cookie (or env default) → server components fetch that org's data (RLS-scoped).
2. Client hydrates → `ActiveOrgProvider` fetches the user's memberships + org names:
   - 0 → `NotProvisioned`; fetch error → retry state.
   - ≥1 → if the active-org cookie isn't one of their orgs (or absent and the env default isn't theirs), set the cookie to their default org and reload once (self-heal); else provide the org context.
3. `OrgSwitcher` (sidebar): >1 org → dropdown → pick → `setActiveOrg` (cookie + reload); ==1 → static label.
4. `getRepo` (client components) reads the same cookie → scopes to the active org.

**One-org-now:** cookie absent → defaults to env `ORG_ID` (= org A); everyone is correct, the switcher is hidden, and no reload ever fires.

## Error handling

- **Memberships fetch error** (transient): explicit retry state, not `NotProvisioned`.
- **Invalid/stale cookie**: self-heal — reset to the default org + reload **once** (ref-guarded; no loop).
- **Server rendered the wrong org** (absent cookie → env default the user isn't in): RLS returns empty (no leak) → client detects mismatch → corrects + reloads → server re-renders with their org.
- **Cookie write blocked on switch**: the reload re-reads the old cookie; UI stays on the prior org rather than breaking.

## Security

- The cookie is a *selection*, not a credential: a forged value cannot leak data — `SupabaseRepository` scopes by it and **RLS denies any org the user isn't a member of** (empty result). The provider validates it against the user's real memberships; the switcher only offers their orgs (defense in depth).
- Authorization derives solely from `memberships` (never JWT/`user_metadata`). Anon key only; no `service_role`. `supabaseConfigured()` unchanged.

## Testing

- **`lib/active-org.ts`** — `readActiveOrgCookie(value)`: returns the value when present, env fallback when undefined/empty; `resolveActiveOrgClient()`: cookie when set, env when not (mock `document.cookie` + env).
- **`ActiveOrgProvider`** (mock the browser client's memberships query): 0 orgs → `NotProvisioned`; ≥1 + valid cookie → renders children + provides the org list; absent/invalid cookie → sets the cookie + triggers exactly one reload (mock `document.cookie` + `window.location.reload`); fetch error → the retry state; **unconfigured → passes children through**.
- **`OrgSwitcher`**: 1 org → static label, no `<select>`; >1 → dropdown lists org names, selecting calls `setActiveOrg` (cookie + reload).
- **Repo org resolution**: the pure `resolveActiveOrg` helpers are unit-tested; the repo construction stays covered by typecheck + both builds (bundler-only client can't construct under vitest — same rationale as H1).
- **Builds**: normal + `STATIC_EXPORT=true` both exit 0; mock-mode behavior byte-for-byte unchanged.

## Non-goals (H2)

- In-app org/membership creation or invites — **H3** (provisioning stays SQL).
- Per-org bookmarkable URLs / multi-org data on one screen — single active org at a time.
- Cross-device "last used" sync, org-scoped roles — out of scope.
- Any change to `supabaseConfigured()` or the mock path.
