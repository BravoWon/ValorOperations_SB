# Slice C — Bank editor (design)

**Parent architecture:** `docs/superpowers/specs/2026-06-08-operations-architecture-design.md` — Administer plane, ⭐ keystone "the Bank editor": *"edit the Bank (code catalog) … writes definitions; read-mostly by everyone else."* Slice C makes the Bank — the curated activity-code catalog every other plane consumes — an **editable, persisted** source of truth with an Admin-plane UI.

**Goal:** Turn the read-only `BANK_SEED` into an editable, persisted code catalog: an Admin-plane page (`/bank-editor`) where an admin can view, search, add, edit, and remove Bank codes (code · label · category · NPT flag · billable flag), persisted through the Repository seam (MockRepository now, Supabase stub later). **Additive and pattern-consistent** — it mirrors the existing Data Manager channel-registry editor exactly (same load/validate/save data-flow, same inline-editable table UX, same `admin` page gating). No change to how `findBankCode`/`assembleTicket` consume the static seed today (that live-catalog wiring is a later integration — see Out of scope).

## Key design decisions

1. **Mirror the proven editable-catalog pattern (Data Manager / channel registry).** The page is a client component that on mount calls `repo.loadBankCodes()`; when storage is empty it returns `null` and the page falls back to `BANK_SEED` (the repository never embeds the seed — same contract as `loadChannels`). State is an in-memory `BankCode[]`; edits mutate state; **Save** persists via `repo.saveBankCodes(codes)` with `idle → saving → saved` feedback. This is the established convention; we do not invent a new one.
2. **Catalogs stay global (not org-scoped) — consistent with channels/vendors/afe.** The existing catalog persistence (`loadChannels`/`saveChannels`, vendors, afe) is not org-scoped; the Bank is a definitional catalog of the same kind. `saveBankCodes(codes)` / `loadBankCodes()` take no `orgId`, persisted under a single `valor:bankcodes` key (browser) / in-memory field (node) — exactly mirroring `valor:channels`. (Per-tenant catalogs are a later cloud/RLS concern, like the other catalogs.)
3. **Pure validation in `@valor/core` returning `warnings[]`.** A new `validateBankCodes(codes): string[]` lives beside the Bank module — flags empty code, empty label, and duplicate codes. It never throws (core convention). The page shows warnings above the table (red alert cards, like Data Manager). Save is **not** blocked by warnings (consistent with the channel editor — warnings are advisory).
4. **Category is an editable string with suggestions from the existing set.** Each `BankCode.category` is edited via an input backed by a `<datalist>` of `BANK_CATEGORIES` (the seed's derived categories) — pick an existing category or type a new one. New categories emerge from data ("config not code"); no separate category-management UI.
5. **Admin page-gating, no per-action gating.** Register `/bank-editor` under the Administer plane with `minRole: 'admin'` (same as Data Manager / Office Ops). The existing `RoleGate` (page-level, via `minRoleForPath`) handles access; below-admin roles see the branded "not available for your role" state. No per-button gating (matches the existing editors).
6. **Slice C is additive.** New core fns (`validateBankCodes`) + 2 repository methods + 1 page + 1 table component + 1 plane-registry entry. Nothing existing is rewired; the static `BANK_SEED` and `findBankCode` are untouched.

## Core — `packages/core/src/well-setup/bank.ts` (extend)

The existing `BankCode { code; label; category; npt; billable }`, `BANK_SEED`, `findBankCode`, `listBankByCategory`, `BANK_CATEGORIES` are unchanged. Add one pure helper:

```ts
/** Advisory validation for an edited Bank catalog. Never throws; returns warnings[]. */
export function validateBankCodes(codes: BankCode[]): string[];
```

- Warns on: an empty `code` (after trim); an empty `label` (after trim) — message includes the code or "(unnamed)"; any duplicate `code` (case-insensitive, trimmed) with its occurrence count.
- Order: per-row empties first (in array order), then duplicates. Deterministic; no `Date.now`/`Math.random`.

## Repository extension (additive — interface + MockRepository + Supabase stub)

Mirror the channel-catalog pair exactly.

`packages/core/src/repository.ts` — add to the `Repository` interface:

```ts
saveBankCodes(codes: import('./well-setup/bank').BankCode[]): Promise<void>;
loadBankCodes(): Promise<import('./well-setup/bank').BankCode[] | null>;
```

`packages/core/src/mock-repository.ts` — add a private field + the pair, following the `valor:channels` pattern:
- field: `private bankCodes: BankCode[] | null = null;`
- `saveBankCodes`: `if (store) store.setItem('valor:bankcodes', JSON.stringify(codes)); else this.bankCodes = structuredClone(codes);`
- `loadBankCodes`: browser → parse `valor:bankcodes` (try/catch → `null`), empty → `null`; node → `this.bankCodes ? structuredClone(...) : null`.
- `resetLocalDb` in-memory branch must also null `this.bankCodes` (the browser branch's `valor:` sweep already covers the key). **`exportSnapshot`/`importSnapshot` (as-built, revised during review):** the Bank IS a full peer of channels/vendors/afe — all editable definitional catalogs — so it is included in the MockRepository LocalDB snapshot (`bankCodes` added to `LocalDbSnapshot`/`COLLECTIONS`, exported/imported/summarized like its peers). This differs from the coded-object graph, which stays out of snapshots because it is a not-yet-wired substrate. The `SupabaseRepository` snapshot path does not yet carry bank codes (the cloud `bank_codes` table is deferred) — same posture as its coded-object handling.

`apps/web/lib/supabase-repository.ts` — add the two methods as throwing stubs **only if** `SupabaseRepository` would otherwise fail typecheck (it `implements Repository`). Reuse the existing "unsupported" throw pattern (a clear message) so the interface contract holds and Mock stays the only working path. *(Confirm during planning whether the scaffold already routes catalog methods to a generic unsupported helper or needs explicit stubs.)*

## Web — Admin-plane page + table

- **`apps/web/lib/planes.ts`** — add to the Administer plane items: `{ href: '/bank-editor', label: 'Bank Editor', icon: <lucide icon>, minRole: 'admin' }` (place between Data Manager and Office Ops). Pick a fitting `lucide-react` icon not already used in the plane (e.g. `Tags`, `ListChecks`, or `Coins`).
- **`apps/web/app/(hub)/bank-editor/page.tsx`** — client page mirroring `data-manager/page.tsx`: `PageHeader` (eyebrow/title/subtitle + Save action), load-on-mount with seed fallback + `LoadingState`, `validateBankCodes` warnings cards, a `Card` wrapping the table. Save button shows `Saving… / Saved` and disables while saving.
- **`apps/web/components/bank-registry.tsx`** — inline-editable table mirroring `channel-registry.tsx`: a search box; columns **Code · Label · Category · NPT · Billable** + a remove button; `code` upper-cased on input; `category` input bound to a `<datalist>` of `BANK_CATEGORIES`; `npt`/`billable` as checkboxes; an **Add code** button appends a blank row (`{ code:'', label:'', category: BANK_CATEGORIES[0] ?? '', npt:false, billable:false }`). Reuse the shared input/button class conventions. Accessible labels on every input (`aria-label`).

## Testing

- **Core (`bank.test.ts`, extend):** `validateBankCodes` — clean catalog → `[]`; empty code → warning; empty label → warning naming the code; duplicate codes (case-insensitive) → one warning with count; deterministic ordering.
- **Repository (`mock-repository.bank.test.ts`, new):** `loadBankCodes()` → `null` before any save; `saveBankCodes` then `loadBankCodes` round-trips (deep-equal, independent clone — mutating the returned array doesn't change stored state); `resetLocalDb` clears persisted bank codes (in-memory path).
- **Web component (`bank-registry.test.tsx`, new, jsdom):** renders rows from props; **Add code** calls `onChange` with an appended blank row; editing a cell calls `onChange` with the patched row; remove calls `onChange` without that row; search filters visible rows by code/label/category. (Mirror the existing channel-registry test.)
- **Web page (smoke):** the page renders the header + table from the seed (loads via the mock); follow whatever render-test convention `data-manager` uses, if any.

## Out of scope (deferred)

- **Live-catalog consumption.** `findBankCode`/`assembleTicket` (Slice B) and Well-Setup still read the static `BANK_SEED`; making consumers read the *persisted* edited catalog is a later integration (alongside Slice E graph-wiring). Slice C persists the catalog and proves the editor; it does not rewire readers.
- **Per-tenant (org-scoped) catalogs + Supabase `bank_codes` table + RLS** — a later cloud step (like the other catalogs).
- **Category management UI, soft-delete/restore, import/export of the catalog, audit trail** — not now (YAGNI).

## Success criteria

`@valor/core` typecheck 0 + new/extended tests green; existing core tests unaffected; `@valor/web` typecheck 0 + tests green; both builds (normal + static export) compile; the Administer plane shows **Bank Editor** for admin+; the page loads the seed, edits persist across reload (localStorage on the live site), warnings surface, and below-admin roles are gated — demonstrable on the live/static site.
