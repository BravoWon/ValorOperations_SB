# Slice D — Template + Field-def builder (design)

**Parent architecture:** `docs/superpowers/specs/2026-06-08-operations-architecture-design.md` — Administer plane, ⭐ keystone "Template builder": *"job/section templates · field-defs … templates (stages · default codes · field-defs) → instantiate Tickets."* Slice D makes the **template model editable and persisted** with an Admin-plane UI.

**Goal:** Turn the read-only seed template model (`JobTemplate` + `TemplateStageDef` + `TemplateFieldDef`, already defined in `@valor/core`) into an **editable, persisted** catalog: an Admin-plane page (`/template-builder`) where an admin selects/adds/removes templates and edits each template's **stages** (name · type · order · default Bank code) and **field-defs** (scope · key · label · type · unit · range · required · enum options), persisted through the Repository seam. **Additive and pattern-consistent** — mirrors the Bank Editor / Data Manager editors. **Consumption stays deferred** (like the Bank): `listTemplates`/`getTemplate`/`createJobFromTemplate` are untouched and keep reading the seed; the builder round-trips through a *new* `loadTemplateBundles`/`saveTemplateBundles` pair. Wiring edited templates into job/Ticket instantiation is **Slice E**.

## Key design decisions

1. **Extend the existing template model — don't replace it.** The types are already well-formed and exported:
   - `JobTemplate { id; orgId; name; jobType; version; isActive }`
   - `TemplateStageDef { id; templateId; name; stageType; defaultSortOrder }`
   - `TemplateFieldDef { id; templateId; scope: 'job'|'stage'; key; label; dataType: 'number'|'text'|'bool'|'date'|'enum'; unit?; minValue?; maxValue?; enumOptions?; required; sortOrder }`
   - `TemplateBundle { template; stageDefs; fieldDefs }`
2. **One additive model change: `defaultCode?` on `TemplateStageDef`.** A stage instantiates to a section Ticket which carries one Bank `code`; the template's "default codes" attach naturally per stage. Add **optional** `defaultCode?: string` (a Bank code) — backward-compatible (existing seed stage-defs omit it). The stage-def editor offers a Bank-code suggestion list. No other model changes.
3. **Whole-collection persistence, mirroring the other catalogs.** The builder edits the full set of `TemplateBundle[]` in memory and persists it as a unit — exactly like `saveChannels`/`saveBankCodes`. New repository pair:
   - `saveTemplateBundles(bundles: TemplateBundle[]): Promise<void>`
   - `loadTemplateBundles(): Promise<TemplateBundle[] | null>` (null when nothing persisted; the page falls back to the seed).
   `MockRepository` stores under `valor:templatebundles` (browser) / in-memory (node), following the established dual pattern; `resetLocalDb` clears it; `SupabaseRepository` gets throwing stubs (the cloud template tables are deferred).
4. **Template bundles are a LocalDB-snapshot peer.** Like channels/vendors/afe/bankCodes, edited template bundles are captured in `exportSnapshot`/`importSnapshot` (`templateBundles` added to `LocalDbSnapshot`/`COLLECTIONS`/`summarizeSnapshot`). Consistent with the Bank precedent (Slice C); the coded-object graph remains the only deliberately-excluded substrate.
5. **Pure validation in `@valor/core`.** New `validateTemplateFieldDefs(defs: TemplateFieldDef[]): string[]` — warns on empty `key`, empty `label`, `enum` type with no `enumOptions`, `minValue > maxValue`, and duplicate `scope:key` (with count). Never throws; coerces defensively (untrusted persisted JSON). Deterministic; no `Date.now`/`Math.random`. A `DEFAULT_TEMPLATE_BUNDLES: TemplateBundle[]` seed constant (assembling the existing `tmpl-drill-vert` template, now with demo `defaultCode`s) is exported for the editor's fallback — parallel to `BANK_SEED`/`DEFAULT_CHANNELS`.
6. **Admin page-gating, no per-action gating.** Register `/template-builder` under the Administer plane with `minRole: 'admin'` (same as Bank Editor / Data Manager). Page-level `RoleGate` handles access.
7. **Slice D is additive.** New core fns/const + 2 repository methods + snapshot wiring + 1 route + the builder UI. Existing `listTemplates`/`getTemplate`/`createJobFromTemplate`/`instantiateStages` are untouched; the seed template model is unchanged except the optional `defaultCode?`.

## Core — `packages/core/src/templates*`

- Add `defaultCode?: string;` to `TemplateStageDef` in `packages/core/src/types.ts` (optional; documented as a Bank code).
- New pure helper (in `packages/core/src/templates.ts` or a new `templates/validate.ts`, surfaced via `index.ts`):

  ```ts
  /** Advisory validation for edited template field-defs. Never throws; returns warnings[]. */
  export function validateTemplateFieldDefs(defs: TemplateFieldDef[]): string[];
  ```
  Warnings: empty `key` ("Field key cannot be empty."); empty `label` (`${key||'(unnamed)'}: label cannot be empty.`); `enum` with no/zero `enumOptions` (`${key}: enum fields need at least one option.`); `minValue > maxValue` (`${key}: min (X) must be ≤ max (Y).`); duplicate `scope:key` (`Duplicate field "scope:key" (N×).`). Per-row issues first (array order), then duplicates.

- New seed constant `DEFAULT_TEMPLATE_BUNDLES: TemplateBundle[]` — assembles the existing `tmpl-drill-vert` (3 stages, 5 field-defs) into one bundle, with demo `defaultCode: 'DRL'` on each stage. Derived from / consistent with the existing `seed.ts` template data (no brand names).

## Repository extension (additive — interface + MockRepository + snapshot + Supabase stub)

`packages/core/src/repository.ts` — add to `Repository`:
```ts
saveTemplateBundles(bundles: import('./repository').TemplateBundle[]): Promise<void>;
loadTemplateBundles(): Promise<import('./repository').TemplateBundle[] | null>;
```
(`TemplateBundle` is already defined/exported from `repository.ts`.)

`packages/core/src/mock-repository.ts` — `private templateBundles: TemplateBundle[] | null = null;`; `saveTemplateBundles`/`loadTemplateBundles` mirroring `saveBankCodes`/`loadBankCodes` (`valor:templatebundles` key; try/catch parse → null; empty → null; `structuredClone`); `resetLocalDb` in-memory branch nulls the field; `exportSnapshot`/`importSnapshot`/`COLLECTIONS`/`LocalDbSnapshot` include `templateBundles` as a peer collection.

`apps/web/lib/supabase-repository.ts` — add a `type TemplateBundle` import + throwing stubs `saveTemplateBundles`/`loadTemplateBundles` via a small `templatesUnsupported(method): never` helper (mirroring `bankUnsupported`). Its `importSnapshot` does not restore `templateBundles` (deferred; comment it, like the bank note). The `supabase-repository.test.ts` `listCollections` count rises to `MODULE_TABLES.length + 2` (bankCodes + templateBundles are known mock-only collections).

`local-db/types.ts` — add `import type { TemplateBundle }`, `templateBundles?: TemplateBundle[]` to `collections`, and `{ key: 'templateBundles', label: 'Templates' }` to `COLLECTIONS`.

## Web — Admin-plane page + builder

- **`apps/web/lib/planes.ts`** — add `{ href: '/template-builder', label: 'Template Builder', icon: LayoutTemplate, minRole: 'admin' }` to the Administer plane (between Data Manager and Bank Editor); add `LayoutTemplate` to the `lucide-react` import.
- **`apps/web/app/(hub)/template-builder/page.tsx`** — client page mirroring `bank-editor/page.tsx`: load `loadTemplateBundles()` (fallback `DEFAULT_TEMPLATE_BUNDLES`) with the `active` guard + `LoadingState`; `validateTemplateFieldDefs` over the selected template's field-defs → warnings cards; Save (disabled until `loaded`; `idle/saving/saved/error`; guards re-entrancy) persists via `saveTemplateBundles`.
- **`apps/web/components/template-builder.tsx`** — the editor (props `{ bundles: TemplateBundle[]; onChange: (next: TemplateBundle[]) => void }`):
  - **Template selector:** a list/tabs of templates (by name); select one to edit; **Add template** (blank `JobTemplate` with a generated id) and **Remove template** buttons.
  - **Template fields:** `name` (text), `jobType` (select: drilling/completion/workover/other), `isActive` (checkbox). `version` shown read-only.
  - **Stage-def table** (`StageDefTable`): columns name · stageType · sortOrder · **defaultCode** (input backed by a `<datalist>` of Bank codes — loaded via `loadBankCodes() ?? BANK_SEED`) + remove; **Add stage**.
  - **Field-def table** (`FieldDefTable`): columns scope (select job/stage) · key · label · dataType (select) · unit · minValue · maxValue · required (checkbox) · enumOptions (comma-separated text → string[]) + remove; **Add field**.
  - All inputs carry `aria-label`s; rows carry stable `data-testid` (`stage-def-row`, `field-def-row`) and key on the canonical index (rows are not reorderable here — editable keys would drop focus). Reuse the Bank/Channel registry Tailwind class conventions.

For focus and testability, `StageDefTable` and `FieldDefTable` are separate components in `apps/web/components/`; `template-builder.tsx` orchestrates selection + the two tables.

## Testing

- **Core (`templates.test.ts`, extend):** `validateTemplateFieldDefs` — clean defs → `[]`; empty key; empty label naming the key; enum without options; min > max; duplicate `scope:key` with count; ordering (per-row before duplicates); empty array → `[]`; tolerates malformed non-string fields without throwing. `DEFAULT_TEMPLATE_BUNDLES` shape (1 bundle, 3 stages with `defaultCode`, 5 field-defs).
- **Repository (`mock-repository.templates.test.ts`, new):** `loadTemplateBundles()` → null before save; `saveTemplateBundles` then `loadTemplateBundles` round-trips with an independent clone; `resetLocalDb` clears it; export/import snapshot round-trips `templateBundles`.
- **Web component (`template-builder.test.tsx`, new, jsdom):** renders templates from props; selecting a template shows its stages/field-defs; **Add stage**/**Add field** append rows (calling `onChange`); editing a field-def cell calls `onChange` with the patch; remove drops the row; the Bank-code datalist offers options; switching template type via the select updates `onChange`. (Mirror the bank-registry test.)
- **Web (existing):** `supabase-repository.test.ts` `listCollections` count → `MODULE_TABLES.length + 2`; `planes.test.ts` nav includes `/template-builder`.

## Out of scope (deferred)

- **Instantiation wiring** — feeding edited templates into `createJobFromTemplate` and seeding a section Ticket's `fields`/`code` from a template's field-defs/default codes is **Slice E**. Slice D edits and persists the definitions; consumers still read the seed (same posture as the Bank).
- **Stage-level field *values*** — where a stage's field values live on the coded-object graph (stage CodedObjects vs timeline) is a Slice E decision; Slice D edits only the *definitions*.
- **Template versioning / immutable per-job snapshots** — a job-schema concern, deferred. Editing mutates the bundle in place; the existing `version` field is shown but not auto-incremented.
- **Per-tenant cloud template tables + RLS** — a later cloud step (like the other catalogs).

## Success criteria

`@valor/core` typecheck 0 + new/extended tests green; existing core tests unaffected (the `defaultCode?` addition is backward-compatible); `@valor/web` typecheck 0 + tests green; both builds (normal + static export) compile; the Administer plane shows **Template Builder** for admin+; the page loads the seed template, edits to stages/field-defs/default-codes persist across reload, validation warnings surface, template bundles round-trip through the LocalDB snapshot, and below-admin roles are gated — demonstrable on the live/static site.
