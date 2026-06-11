# Microsoft SSO activation runbook (Auth H1)

How to turn on real Microsoft/Entra sign-in for the web app. The auth code (Slice **H1**) is already merged; these are the **manual** one-time steps to make it live. Until they're done, the app runs as the open mock demo (no Supabase env = `MockRepository`, demo `/login`).

**Project ref:** `ekswyggelycioeupgfil` · **Tenant:** `jtech.ai` (single-tenant) · **Demo org A:** `00000000-0000-0000-0000-000000000001`

Two callback URLs that are easy to confuse:

- **Azure → Supabase:** `https://ekswyggelycioeupgfil.supabase.co/auth/v1/callback` — goes in the **Azure** app registration.
- **Supabase → app:** `https://<your-app-origin>/auth/callback` — goes in **Supabase's** redirect allowlist; the H1 code sends it via `redirectTo` (`origin + NEXT_PUBLIC_BASE_PATH + /auth/callback`).

> Reference: <https://supabase.com/docs/guides/auth/social-login/auth-azure>

---

## Part A — Azure Portal (Entra app registration)

At **portal.azure.com → Microsoft Entra ID → App registrations → New registration**.

- [ ] **Name:** `Valor Operations` (anything).
- [ ] **Supported account types:** **"Accounts in this organizational directory only (jtech.ai only — Single tenant)"**.
- [ ] **Redirect URI:** platform **Web**, value:
  ```
  https://ekswyggelycioeupgfil.supabase.co/auth/v1/callback
  ```
  → **Register**.
- [ ] On the app **Overview**, copy:
  - **Application (client) ID** → paste into Supabase (Part B).
  - **Directory (tenant) ID** → used in the Tenant URL (Part B).
- [ ] **Certificates & secrets → Client secrets → New client secret** → pick an expiry → **Add**.
  - ⚠️ **Copy the `Value` column, NOT `Secret ID`.** The Value is shown only once.
- [ ] **(Recommended, security) Manifest → add the optional `xms_edov` claim** so Supabase can distinguish verified vs unverified emails (guards against email-domain impersonation — see the Supabase doc's "Unverified Email Domain" note).
- [ ] **API permissions:** default `User.Read` (openid/profile/email) is enough — the app requests `scopes: 'email'`. If your tenant enforces it, click **Grant admin consent for jtech.ai**.

---

## Part B — Supabase dashboard (Azure provider)

**Authentication → Providers → Azure**
(<https://supabase.com/dashboard/project/ekswyggelycioeupgfil/auth/providers>)

- [ ] Toggle **Azure** on.
- [ ] **Application (Client) ID** → paste from Part A.
- [ ] **Secret Value** → paste the client-secret **Value** (not the ID).
- [ ] **Azure Tenant URL** → single-tenant, so only jtech.ai accounts work:
  ```
  https://login.microsoftonline.com/<Directory-tenant-ID>
  ```
  (Blank defaults to `/common`/multi-tenant — don't leave it blank.)
- [ ] **Save.**

**Authentication → URL Configuration**

- [ ] **Site URL** → primary app origin, e.g. `https://operations.valorenp.com`.
- [ ] **Redirect URLs (allowlist)** → add every origin's callback:
  ```
  http://localhost:3000/auth/callback
  https://operations.valorenp.com/auth/callback
  ```
  (Add preview/Vercel origins too. Must match the app's `redirectTo`.)

---

## Part C — Point the app at Supabase

Create **`apps/web/.env.local`** (gitignored):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ekswyggelycioeupgfil.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
NEXT_PUBLIC_SUPABASE_ORG_ID=00000000-0000-0000-0000-000000000001
```

- [ ] Anon key: **Project Settings → API → Project API keys → `anon` `public`** (or `npx supabase projects api-keys --project-ref ekswyggelycioeupgfil`). **Never** use `service_role` here.
- [ ] All three present → the app flips to `SupabaseRepository` + the real auth gate. Missing any → stays the open mock demo.

---

## Part D — Seed the first membership (chicken-and-egg)

RLS denies everything until a `memberships` row exists, and you can't create one until the user exists in `auth.users`. So:

- [ ] Run `corepack pnpm --filter @valor/web dev`, click **Sign in with Microsoft**, sign in as **`b.jones@jtech.ai`**. You'll land on **"Access not provisioned"** — expected; it created your `auth.users` row.
- [ ] Get your `auth.users` id: **Authentication → Users** (copy the UUID for `b.jones@jtech.ai`).
- [ ] Seed the owner membership (SQL editor, or the Management API):
  ```sql
  insert into public.memberships (org_id, user_id, role)
  values ('00000000-0000-0000-0000-000000000001', '<your-auth.users-uuid>', 'owner')
  on conflict do nothing;
  ```
- [ ] Sign out → sign in again → the app loads org A's data (RLS-served).

---

## Part E — Verify

- [ ] Unauthenticated visit → redirected to `/login`.
- [ ] Sign in with Microsoft → `/auth/callback` → app.
- [ ] A Microsoft account **without** a membership → `NotProvisioned`; **with** → full app, scoped to org A.
- [ ] Sign out → back to `/login`.

---

**Gotchas**

- **Local dev:** Azure rejects `127.0.0.1` as a redirect — use `http://localhost:3000` (already allowlisted), not the IP.
- **Anon key only** in `NEXT_PUBLIC_*`. RLS is the real boundary; the middleware gate is defense-in-depth.
- **The seeded `vep-demo@example.com`** (email/password) is **not** the SSO path — SSO users come from Entra. It exists only for the earlier RLS validation.
- **Two build targets:** the configured (Vercel) build runs the real auth; the `STATIC_EXPORT=true` build runs unconfigured (mock + the client `AuthGate` demo-cookie gate). They're mutually exclusive by deploy config.
