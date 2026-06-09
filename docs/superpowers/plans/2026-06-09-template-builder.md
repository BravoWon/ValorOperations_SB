# Template + Field-def builder (Slice D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the seed template model (`JobTemplate` + `TemplateStageDef` + `TemplateFieldDef`) editable and persisted with an Admin-plane Template Builder (`/template-builder`), mirroring the Bank Editor.

**Architecture:** Additive. A pure `validateTemplateFieldDefs` + a `DEFAULT_TEMPLATE_BUNDLES` seed + an optional `defaultCode?` on `TemplateStageDef` in `@valor/core`; a whole-collection `saveTemplateBundles`/`loadTemplateBundles` Repository pair (MockRepository `valor:templatebundles` + LocalDB-snapshot peer; SupabaseRepository throwing stubs); an Administer-plane page + a `TemplateBuilder` orchestrator with `StageDefTable` + `FieldDefTable`. Existing `listTemplates`/`getTemplate`/`createJobFromTemplate` are untouched — edited-template consumption is deferred to Slice E (same posture as the Bank).

**Tech Stack:** TypeScript, `@valor/core` (pure, Vitest node), `@valor/web` (Next 15 App Router, React 19, Tailwind, Vitest/jsdom + @testing-library/react). Branch: `feat/template-builder` (already created). Spec: `docs/superpowers/specs/2026-06-09-template-builder-design.md`.

**Constraints:** No `Date.now`/`Math.random` in `@valor/core`. `warnings: string[]`, never throw (except the deliberate Supabase stub). Additive — existing tests stay green; both typechecks 0; both web builds (normal + static export) pass. MockRepository stays default. IP guardrail: generic terms only (use `DEMO_ORG_ID`, never the literal org string).

> **Post-review deviations (as-built, PR #23).** Code blocks below are the original pre-implementation recipe; three refinements landed during dual-bot review and are the source of truth in the merged code:
> 1. **`asTrimmed` is shared, not local.** Extracted to `packages/core/src/internal/coerce.ts` and imported by both `templates.ts` and `well-setup/bank.ts` (DRY); it is NOT re-exported from `index.ts`.
> 2. **Seed `templateStageDefs` gained `defaultCode: 'DRL'`** so the seed (read by `getTemplate`) matches `DEFAULT_TEMPLATE_BUNDLES`.
> 3. **Collision-safe ids.** The three `add` helpers (template/stage/field) use a shared `nextSuffixId(prefix, ids)` (`apps/web/lib/next-id.ts`, max-existing-suffix + 1) instead of a length-based `${prefix}${len+1}` counter, which could collide after add→remove→add. Plus proactive tests (saved-empty `[]` sentinel, Supabase stub throws, add/remove-template id-uniqueness).

Commands (run from the repository root):
- Core one: `corepack pnpm --filter @valor/core test -- <name>` · all: `corepack pnpm --filter @valor/core test` · typecheck: `corepack pnpm --filter @valor/core typecheck`
- Web one: `corepack pnpm --filter @valor/web test -- <name>` · all: `corepack pnpm --filter @valor/web test` · typecheck: `corepack pnpm --filter @valor/web typecheck` · build: `corepack pnpm --filter @valor/web build`

Reference types (already defined): `JobTemplate { id; orgId; name; jobType: JobType; version; isActive }`, `TemplateStageDef { id; templateId; name; stageType; defaultSortOrder }`, `TemplateFieldDef { id; templateId; scope: FieldScope; key; label; dataType: FieldDataType; unit?; minValue?; maxValue?; enumOptions?; required; sortOrder }`, `TemplateBundle { template; stageDefs; fieldDefs }` (in `repository.ts`). `JobType = 'drilling'|'completion'|'workover'|'other'`, `FieldScope = 'job'|'stage'`, `FieldDataType = 'number'|'text'|'bool'|'date'|'enum'` (in `enums.ts`).

---

## File Structure
- **Modify `packages/core/src/types.ts`** — add optional `defaultCode?` to `TemplateStageDef`.
- **Modify `packages/core/src/templates.ts`** — add `validateTemplateFieldDefs` + `DEFAULT_TEMPLATE_BUNDLES`.
- **Modify `packages/core/src/repository.ts`** — 2 method signatures.
- **Modify `packages/core/src/mock-repository.ts`** — field + 2 methods + reset + snapshot wiring.
- **Modify `packages/core/src/local-db/types.ts`** — `templateBundles` in snapshot + COLLECTIONS.
- **Modify `apps/web/lib/supabase-repository.ts`** — import + stub helper + 2 stubs + import-snapshot comment.
- **Modify `apps/web/lib/planes.ts`** — register `/template-builder`.
- **Create** `apps/web/components/stage-def-table.tsx`, `apps/web/components/field-def-table.tsx`, `apps/web/components/template-builder.tsx`, `apps/web/app/(hub)/template-builder/page.tsx`.
- **Test** `packages/core/test/templates.test.ts` (extend/create), `packages/core/test/mock-repository.templates.test.ts` (new), `apps/web/__tests__/template-builder.test.tsx` (new); update `apps/web/__tests__/supabase-repository.test.ts` + `apps/web/__tests__/planes.test.ts`.

---

### Task 1: Core — `defaultCode`, `validateTemplateFieldDefs`, `DEFAULT_TEMPLATE_BUNDLES`

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/templates.ts`
- Test: `packages/core/test/templates.test.ts`

- [ ] **Step 1: Write the failing tests** — create (or extend) `packages/core/test/templates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateTemplateFieldDefs, DEFAULT_TEMPLATE_BUNDLES } from '../src/templates';
import type { TemplateFieldDef } from '../src/types';

const fd = (over: Partial<TemplateFieldDef>): TemplateFieldDef => ({
  id: 'x', templateId: 't', scope: 'job', key: 'k', label: 'L', dataType: 'number', required: false, sortOrder: 1, ...over,
});

describe('validateTemplateFieldDefs', () => {
  it('clean defs yield no warnings', () => {
    expect(validateTemplateFieldDefs([fd({})])).toEqual([]);
  });
  it('flags an empty key', () => {
    expect(validateTemplateFieldDefs([fd({ key: '  ' })]).some((m) => /key cannot be empty/i.test(m))).toBe(true);
  });
  it('flags an empty label, naming the key', () => {
    expect(validateTemplateFieldDefs([fd({ key: 'target_wob', label: ' ' })]).some((m) => /target_wob: label cannot be empty/i.test(m))).toBe(true);
  });
  it('flags an enum field with no options', () => {
    expect(validateTemplateFieldDefs([fd({ key: 'phase', dataType: 'enum' })]).some((m) => /phase: enum fields need at least one option/i.test(m))).toBe(true);
  });
  it('flags min > max', () => {
    expect(validateTemplateFieldDefs([fd({ key: 'rop', minValue: 10, maxValue: 5 })]).some((m) => /rop: min \(10\) must be ≤ max \(5\)/.test(m))).toBe(true);
  });
  it('flags duplicate scope:key with a count', () => {
    const w = validateTemplateFieldDefs([fd({ key: 'd', scope: 'job' }), fd({ key: 'd', scope: 'job' })]);
    expect(w.some((m) => /Duplicate field "job:d" \(2×\)/.test(m))).toBe(true);
  });
  it('same key in different scopes is not a duplicate', () => {
    expect(validateTemplateFieldDefs([fd({ key: 'd', scope: 'job' }), fd({ key: 'd', scope: 'stage' })]).some((m) => /Duplicate/.test(m))).toBe(false);
  });
  it('emits per-row issues before duplicates', () => {
    const w = validateTemplateFieldDefs([fd({ key: '' }), fd({ key: 'd' }), fd({ key: 'd' })]);
    const emptyIdx = w.findIndex((m) => /key cannot be empty/i.test(m));
    const dupIdx = w.findIndex((m) => /Duplicate field "job:d"/.test(m));
    expect(emptyIdx).toBeGreaterThanOrEqual(0);
    expect(dupIdx).toBeGreaterThan(emptyIdx);
  });
  it('empty array yields no warnings', () => {
    expect(validateTemplateFieldDefs([])).toEqual([]);
  });
  it('tolerates malformed non-string fields without throwing', () => {
    const bad = [{ id: 'x', templateId: 't', scope: 'job', key: null, label: 1, dataType: 'number', required: false, sortOrder: 1 }] as unknown as TemplateFieldDef[];
    expect(() => validateTemplateFieldDefs(bad)).not.toThrow();
    expect(validateTemplateFieldDefs(bad).some((m) => /key cannot be empty/i.test(m))).toBe(true);
  });
});

describe('DEFAULT_TEMPLATE_BUNDLES', () => {
  it('has one bundle: 3 stages (each with a defaultCode) + 5 field-defs', () => {
    expect(DEFAULT_TEMPLATE_BUNDLES.length).toBe(1);
    const b = DEFAULT_TEMPLATE_BUNDLES[0]!;
    expect(b.stageDefs.length).toBe(3);
    expect(b.stageDefs.every((s) => typeof s.defaultCode === 'string' && s.defaultCode.length > 0)).toBe(true);
    expect(b.fieldDefs.length).toBe(5);
    expect(b.fieldDefs.filter((f) => f.scope === 'job').length).toBe(3);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/core test -- templates`
Expected: FAIL — `validateTemplateFieldDefs`/`DEFAULT_TEMPLATE_BUNDLES` not exported.

- [ ] **Step 3: Add `defaultCode?` to `TemplateStageDef`** in `packages/core/src/types.ts`:

```ts
export interface TemplateStageDef {
  id: string;
  templateId: string;
  name: string;
  stageType: string;
  defaultSortOrder: number;
  defaultCode?: string; // optional Bank code seeded onto the section Ticket on instantiation (Slice E)
}
```

- [ ] **Step 4: Implement in `packages/core/src/templates.ts`** — add these imports at the top (keep the existing imports) and append the new exports:

```ts
import type { TemplateFieldDef } from './types';
import type { TemplateBundle } from './repository'; // type-only: no runtime cycle
import { DEMO_ORG_ID } from './seed';
```

```ts
/** Coerce a possibly-malformed persisted field to a trimmed string (keeps the fn total). */
function asTrimmed(v: unknown): string {
  return typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
}

/**
 * Advisory validation for edited template field-defs. Never throws; returns warnings[].
 * Fields are coerced defensively (catalog may be loaded from untrusted persisted JSON).
 */
export function validateTemplateFieldDefs(defs: TemplateFieldDef[]): string[] {
  const warnings: string[] = [];
  for (const d of defs) {
    const key = asTrimmed(d.key);
    if (!key) warnings.push('Field key cannot be empty.');
    if (!asTrimmed(d.label)) warnings.push(`${key || '(unnamed)'}: label cannot be empty.`);
    if (d.dataType === 'enum' && (!Array.isArray(d.enumOptions) || d.enumOptions.length === 0)) {
      warnings.push(`${key || '(unnamed)'}: enum fields need at least one option.`);
    }
    if (typeof d.minValue === 'number' && typeof d.maxValue === 'number' && d.minValue > d.maxValue) {
      warnings.push(`${key || '(unnamed)'}: min (${d.minValue}) must be ≤ max (${d.maxValue}).`);
    }
  }
  // Duplicate scope:key (first-seen order).
  const counts = new Map<string, { display: string; n: number }>();
  for (const d of defs) {
    const key = asTrimmed(d.key);
    if (!key) continue;
    const composite = `${d.scope}:${key}`;
    const entry = counts.get(composite);
    if (entry) entry.n += 1;
    else counts.set(composite, { display: composite, n: 1 });
  }
  for (const { display, n } of counts.values()) {
    if (n > 1) warnings.push(`Duplicate field "${display}" (${n}×).`);
  }
  return warnings;
}

const TMPL = 'tmpl-drill-vert';

/** Seed template catalog (one bundle) — the editor's fallback when nothing is persisted. */
export const DEFAULT_TEMPLATE_BUNDLES: TemplateBundle[] = [
  {
    template: { id: TMPL, orgId: DEMO_ORG_ID, name: 'Vertical Well — Drill & Case', jobType: 'drilling', version: 1, isActive: true },
    stageDefs: [
      { id: 'tsd-1', templateId: TMPL, name: 'Conductor', stageType: 'drill_case', defaultSortOrder: 10, defaultCode: 'DRL' },
      { id: 'tsd-2', templateId: TMPL, name: 'Surface', stageType: 'drill_case', defaultSortOrder: 20, defaultCode: 'DRL' },
      { id: 'tsd-3', templateId: TMPL, name: 'Production', stageType: 'drill_case', defaultSortOrder: 30, defaultCode: 'DRL' },
    ],
    fieldDefs: [
      { id: 'tfd-1', templateId: TMPL, scope: 'job', key: 'target_wob', label: 'Target WOB', dataType: 'number', unit: 'klbf', minValue: 0, maxValue: 60, required: false, sortOrder: 1 },
      { id: 'tfd-2', templateId: TMPL, scope: 'job', key: 'target_rop', label: 'Target ROP', dataType: 'number', unit: 'ft/hr', minValue: 0, maxValue: 300, required: false, sortOrder: 2 },
      { id: 'tfd-3', templateId: TMPL, scope: 'job', key: 'spud_mud_weight', label: 'Spud Mud Weight', dataType: 'number', unit: 'ppg', minValue: 8, maxValue: 18, required: false, sortOrder: 3 },
      { id: 'tfd-4', templateId: TMPL, scope: 'stage', key: 'depth_in', label: 'Depth In', dataType: 'number', unit: 'ft', required: false, sortOrder: 1 },
      { id: 'tfd-5', templateId: TMPL, scope: 'stage', key: 'depth_out', label: 'Depth Out', dataType: 'number', unit: 'ft', required: false, sortOrder: 2 },
    ],
  },
];
```

- [ ] **Step 5: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/core test -- templates` → PASS. `corepack pnpm --filter @valor/core typecheck` → 0.
(If typecheck reports an import cycle from `./repository`, confirm the import is `import type` — type-only imports are erased and cannot cycle at runtime.)

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/templates.ts packages/core/test/templates.test.ts
git commit -m "feat(core): template field-def validation + seed bundles + stage defaultCode"
```
End every commit body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 2: Repository interface + MockRepository persistence + snapshot

**Files:**
- Modify: `packages/core/src/repository.ts`, `packages/core/src/mock-repository.ts`, `packages/core/src/local-db/types.ts`
- Test: `packages/core/test/mock-repository.templates.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/core/test/mock-repository.templates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEFAULT_TEMPLATE_BUNDLES } from '../src/templates';

describe('MockRepository template bundles', () => {
  it('null before save', async () => {
    expect(await new MockRepository().loadTemplateBundles()).toBeNull();
  });
  it('round-trips and returns an independent clone', async () => {
    const r = new MockRepository();
    await r.saveTemplateBundles(DEFAULT_TEMPLATE_BUNDLES);
    const loaded = await r.loadTemplateBundles();
    expect(loaded?.length).toBe(1);
    expect(loaded![0]!.template.id).toBe('tmpl-drill-vert');
    loaded![0]!.template.name = 'MUTATED';
    const again = await r.loadTemplateBundles();
    expect(again![0]!.template.name).toBe('Vertical Well — Drill & Case');
  });
  it('resetLocalDb clears persisted template bundles (in-memory path)', async () => {
    const r = new MockRepository();
    await r.saveTemplateBundles(DEFAULT_TEMPLATE_BUNDLES);
    await r.resetLocalDb();
    expect(await r.loadTemplateBundles()).toBeNull();
  });
  it('round-trips template bundles through export/import snapshot', async () => {
    const a = new MockRepository();
    await a.saveTemplateBundles(DEFAULT_TEMPLATE_BUNDLES);
    const snap = await a.exportSnapshot();
    expect(snap.collections.templateBundles?.length).toBe(1);
    const b = new MockRepository();
    await b.importSnapshot(snap);
    expect((await b.loadTemplateBundles())?.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `corepack pnpm --filter @valor/core test -- mock-repository.templates`
Expected: FAIL — `saveTemplateBundles` not a function.

- [ ] **Step 3: Add 2 signatures to `packages/core/src/repository.ts`** — inside the `Repository` interface, immediately after the `loadBankCodes()` line:

```ts
  saveTemplateBundles(bundles: TemplateBundle[]): Promise<void>;
  loadTemplateBundles(): Promise<TemplateBundle[] | null>;
```

(`TemplateBundle` is defined at the top of `repository.ts` — reference it directly.)

- [ ] **Step 4: Add the field + 2 methods to `packages/core/src/mock-repository.ts`**

Add the field with the other catalog fields (after `private bankCodes: ... | null = null;`):

```ts
  private templateBundles: import('./repository').TemplateBundle[] | null = null;
```

Add the methods immediately after `loadBankCodes` (mirror it exactly):

```ts
  async saveTemplateBundles(bundles: import('./repository').TemplateBundle[]): Promise<void> {
    const store = this.browserStorage;
    if (store) store.setItem('valor:templatebundles', JSON.stringify(bundles));
    else this.templateBundles = structuredClone(bundles);
  }

  async loadTemplateBundles(): Promise<import('./repository').TemplateBundle[] | null> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:templatebundles'); if (raw) { try { return JSON.parse(raw) as import('./repository').TemplateBundle[]; } catch { return null; } } return null; }
    return this.templateBundles ? structuredClone(this.templateBundles) : null;
  }
```

- [ ] **Step 5: Wire `resetLocalDb` + `exportSnapshot` + `importSnapshot`** in `mock-repository.ts`

In `resetLocalDb`'s in-memory `else` branch, add `this.templateBundles = null;` next to `this.bankCodes = null;`:
```ts
      this.channels = null; this.vendors = null; this.afe = null;
      this.bankCodes = null;
      this.templateBundles = null;
      this.codedObjects = null; this.relationsList = null; this.timelines = null;
```

In `exportSnapshot`, add `templateBundles: []` to the `collections` initializer (after `bankCodes: []`):
```ts
      dashboards: [], wellSetups: [], rigDays: [], channels: [], vendors: [], afe: [], bankCodes: [], templateBundles: [],
```
In its browser branch, after the `valor:bankcodes` line add:
```ts
          else if (k === 'valor:templatebundles') collections.templateBundles = JSON.parse(raw);
```
In its in-memory branch, after the `collections.bankCodes = ...` line add:
```ts
      collections.templateBundles = this.templateBundles ? structuredClone(this.templateBundles) : [];
```

In `importSnapshot`, after the `c.bankCodes` restore line add:
```ts
    if (Array.isArray(c.templateBundles)) { try { await this.saveTemplateBundles(c.templateBundles); } catch { /* skip */ } }
```

- [ ] **Step 6: Add to the snapshot type** in `packages/core/src/local-db/types.ts`

Add the import beside the others:
```ts
import type { TemplateBundle } from '../repository';
```
Add to the `collections` object type (after `bankCodes?`):
```ts
    bankCodes?: BankCode[];
    templateBundles?: TemplateBundle[];
```
Add to the `COLLECTIONS` array (after the `bankCodes` entry):
```ts
  { key: 'bankCodes', label: 'Bank Codes' },
  { key: 'templateBundles', label: 'Templates' },
```

- [ ] **Step 7: Run + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/core test -- mock-repository.templates` → PASS (4). `corepack pnpm --filter @valor/core typecheck` → 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/repository.ts packages/core/src/mock-repository.ts packages/core/src/local-db/types.ts packages/core/test/mock-repository.templates.test.ts
git commit -m "feat(core): Repository + MockRepository template-bundle persistence (snapshot peer)"
```

---

### Task 3: SupabaseRepository stubs + listCollections test

**Files:**
- Modify: `apps/web/lib/supabase-repository.ts`, `apps/web/__tests__/supabase-repository.test.ts`

- [ ] **Step 1: Add the type import** — in the `import { ... } from '@valor/core'` type block, add:
```ts
  type TemplateBundle,
```

- [ ] **Step 2: Add a helper + 2 throwing stubs** to the `SupabaseRepository` class, after the bank stubs:
```ts
  // --- template bundles (Slice D is mock-only; cloud template tables are a later step) ---
  private templatesUnsupported(method: string): never {
    throw new Error(
      `SupabaseRepository.${method}: template catalog not implemented in the Supabase scaffold (Slice D is mock-only).`,
    );
  }
  async saveTemplateBundles(_bundles: TemplateBundle[]): Promise<void> { this.templatesUnsupported('saveTemplateBundles'); }
  async loadTemplateBundles(): Promise<TemplateBundle[] | null> { this.templatesUnsupported('loadTemplateBundles'); }
```

- [ ] **Step 3: Note the snapshot deferral** — in `SupabaseRepository.importSnapshot`, after the existing `c.bankCodes` deferral comment, add:
```ts
    // c.templateBundles is likewise not restored here (cloud template tables deferred).
```

- [ ] **Step 4: Update the listCollections assertion** in `apps/web/__tests__/supabase-repository.test.ts` — change the count + comment:
```ts
    // listCollections summarizes ALL known collections: the 6 Supabase-backed module
    // tables + two mock-only catalogs (Bank Codes, Templates) that have no cloud table
    // yet, so they summarize to count 0 here.
    const info = await repo.listCollections();
    expect(info.length).toBe(MODULE_TABLES.length + 2);
    expect(info.every((c) => c.count === 0)).toBe(true);
```

- [ ] **Step 5: Web typecheck, verify pass**

Run: `corepack pnpm --filter @valor/web typecheck` → 0.
Run: `corepack pnpm --filter @valor/web test -- supabase-repository` → PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/supabase-repository.ts apps/web/__tests__/supabase-repository.test.ts
git commit -m "feat(web): SupabaseRepository template-bundle stubs; listCollections counts Templates"
```

---

### Task 4: Web — plane + StageDefTable + FieldDefTable + TemplateBuilder + page

**Files:**
- Modify: `apps/web/lib/planes.ts`, `apps/web/__tests__/planes.test.ts`
- Create: `apps/web/components/stage-def-table.tsx`, `apps/web/components/field-def-table.tsx`, `apps/web/components/template-builder.tsx`, `apps/web/app/(hub)/template-builder/page.tsx`
- Test: `apps/web/__tests__/template-builder.test.tsx`

- [ ] **Step 1: Register the route** in `apps/web/lib/planes.ts`

Add `LayoutTemplate` to the `lucide-react` import (the line with `Database, Building2, BarChart3, HardDrive, Tags,`):
```ts
  Database, Building2, BarChart3, HardDrive, Tags, LayoutTemplate,
```
Add the item to the Administer plane, between Data Manager and Bank Editor:
```ts
      { href: '/data-manager', label: 'Data Manager', icon: Database, minRole: 'admin' },
      { href: '/template-builder', label: 'Template Builder', icon: LayoutTemplate, minRole: 'admin' },
      { href: '/bank-editor', label: 'Bank Editor', icon: Tags, minRole: 'admin' },
```
In `apps/web/__tests__/planes.test.ts`, add `'/template-builder'` to the `EXISTING_NAV` array (in positional order, between `/data-manager` and `/bank-editor`).

- [ ] **Step 2: Write the failing component test** — create `apps/web/__tests__/template-builder.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DEFAULT_TEMPLATE_BUNDLES, BANK_SEED } from '@valor/core';
import { TemplateBuilder } from '@/components/template-builder';

const bankCodes = BANK_SEED.map((b) => b.code);

describe('TemplateBuilder', () => {
  it('renders the template name', () => {
    const onChange = vi.fn();
    const { getByDisplayValue } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    expect(getByDisplayValue('Vertical Well — Drill & Case')).toBeTruthy();
  });

  it('adds a stage row via onChange', () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    fireEvent.click(getByText(/Add stage/i));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].stageDefs.length).toBe(DEFAULT_TEMPLATE_BUNDLES[0]!.stageDefs.length + 1);
  });

  it('adds a field row via onChange', () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    fireEvent.click(getByText(/Add field/i));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].fieldDefs.length).toBe(DEFAULT_TEMPLATE_BUNDLES[0]!.fieldDefs.length + 1);
  });

  it('edits a field-def label via onChange', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    fireEvent.change(getAllByLabelText(/^Field label$/i)[0] as HTMLInputElement, { target: { value: 'Target WOB X' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].fieldDefs[0].label).toBe('Target WOB X');
  });

  it('removes a field row', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    fireEvent.click(getAllByLabelText(/Remove field/i)[0] as HTMLElement);
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].fieldDefs.length).toBe(DEFAULT_TEMPLATE_BUNDLES[0]!.fieldDefs.length - 1);
  });

  it('offers bank codes as stage defaultCode datalist options', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    expect(container.querySelectorAll('datalist option').length).toBe(bankCodes.length);
  });

  it('changes the template jobType via the select', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    fireEvent.change(getByLabelText(/Job type/i), { target: { value: 'completion' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].template.jobType).toBe('completion');
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `corepack pnpm --filter @valor/web test -- template-builder`
Expected: FAIL — cannot resolve `@/components/template-builder`.

- [ ] **Step 4: Implement `apps/web/components/stage-def-table.tsx`**

```tsx
'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { TemplateStageDef } from '@valor/core';

export interface StageDefTableProps {
  stages: TemplateStageDef[];
  bankCodes: string[];
  templateId: string;
  onChange: (next: TemplateStageDef[]) => void;
}

const CELL =
  'w-full rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const BANK_LIST_ID = 'stage-bank-codes';

export function StageDefTable({ stages, bankCodes, templateId, onChange }: StageDefTableProps) {
  const patch = (i: number, next: Partial<TemplateStageDef>) => {
    const row = stages[i];
    if (!row) return;
    const copy = stages.slice();
    copy[i] = { ...row, ...next };
    onChange(copy);
  };
  const removeAt = (i: number) => onChange(stages.filter((_, j) => j !== i));
  const add = () =>
    onChange([
      ...stages,
      { id: `tsd-new-${stages.length + 1}`, templateId, name: '', stageType: '', defaultSortOrder: (stages.length + 1) * 10 },
    ]);

  return (
    <div className="space-y-3">
      <datalist id={BANK_LIST_ID}>
        {bankCodes.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Stage', 'Type', 'Order', 'Default code'].map((h) => (
                <th key={h} className="pb-1.5 pr-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">{h}</th>
              ))}
              <th className="w-8 pb-1.5" />
            </tr>
          </thead>
          <tbody>
            {stages.map((s, i) => (
              <tr key={i} data-testid="stage-def-row" className="border-t border-white/[0.05]">
                <td className="py-1 pr-2"><input aria-label="Stage name" type="text" value={s.name} onChange={(e) => patch(i, { name: e.target.value })} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Stage type" type="text" value={s.stageType} onChange={(e) => patch(i, { stageType: e.target.value })} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Sort order" type="number" step="1" value={Number.isFinite(s.defaultSortOrder) ? String(s.defaultSortOrder) : ''} onChange={(e) => patch(i, { defaultSortOrder: e.target.value === '' ? 0 : Number(e.target.value) })} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Default code" type="text" list={BANK_LIST_ID} value={s.defaultCode ?? ''} onChange={(e) => patch(i, { defaultCode: e.target.value.toUpperCase() })} className={CELL} /></td>
                <td className="py-1">
                  <button type="button" aria-label={`Remove stage ${s.name || i + 1}`} onClick={() => removeAt(i)} className="rounded-md border border-white/[0.08] p-1 text-muted-foreground/60 transition-colors hover:border-red/40 hover:text-red">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={add} className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]">
        <Plus className="h-3 w-3" strokeWidth={2.5} /> Add stage
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Implement `apps/web/components/field-def-table.tsx`**

```tsx
'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { TemplateFieldDef, FieldScope, FieldDataType } from '@valor/core';

export interface FieldDefTableProps {
  fields: TemplateFieldDef[];
  templateId: string;
  onChange: (next: TemplateFieldDef[]) => void;
}

const CELL =
  'w-full rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const SCOPES: FieldScope[] = ['job', 'stage'];
const TYPES: FieldDataType[] = ['number', 'text', 'bool', 'date', 'enum'];

function numDisplay(v: number | undefined): string {
  return Number.isFinite(v) ? String(v) : '';
}

export function FieldDefTable({ fields, templateId, onChange }: FieldDefTableProps) {
  const patch = (i: number, next: Partial<TemplateFieldDef>) => {
    const row = fields[i];
    if (!row) return;
    const copy = fields.slice();
    copy[i] = { ...row, ...next };
    onChange(copy);
  };
  const patchOptionalNum = (i: number, key: 'minValue' | 'maxValue', raw: string) => {
    const row = fields[i];
    if (!row) return;
    const copy = fields.slice();
    if (raw === '') { const { [key]: _omit, ...rest } = row; copy[i] = rest as TemplateFieldDef; }
    else copy[i] = { ...row, [key]: Number(raw) };
    onChange(copy);
  };
  const removeAt = (i: number) => onChange(fields.filter((_, j) => j !== i));
  const add = () =>
    onChange([
      ...fields,
      { id: `tfd-new-${fields.length + 1}`, templateId, scope: 'job', key: '', label: '', dataType: 'number', required: false, sortOrder: fields.length + 1 },
    ]);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Scope', 'Key', 'Label', 'Type', 'Unit', 'Min', 'Max', 'Req', 'Enum options'].map((h) => (
                <th key={h} className="pb-1.5 pr-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">{h}</th>
              ))}
              <th className="w-8 pb-1.5" />
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={i} data-testid="field-def-row" className="border-t border-white/[0.05]">
                <td className="py-1 pr-2">
                  <select aria-label="Field scope" value={f.scope} onChange={(e) => patch(i, { scope: e.target.value as FieldScope })} className={CELL}>
                    {SCOPES.map((s) => (<option key={s} value={s}>{s}</option>))}
                  </select>
                </td>
                <td className="py-1 pr-2"><input aria-label="Field key" type="text" value={f.key} onChange={(e) => patch(i, { key: e.target.value })} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Field label" type="text" value={f.label} onChange={(e) => patch(i, { label: e.target.value })} className={CELL} /></td>
                <td className="py-1 pr-2">
                  <select aria-label="Field type" value={f.dataType} onChange={(e) => patch(i, { dataType: e.target.value as FieldDataType })} className={CELL}>
                    {TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </td>
                <td className="py-1 pr-2"><input aria-label="Field unit" type="text" value={f.unit ?? ''} onChange={(e) => patch(i, { unit: e.target.value })} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Field min" type="number" step="any" value={numDisplay(f.minValue)} onChange={(e) => patchOptionalNum(i, 'minValue', e.target.value)} className={CELL} /></td>
                <td className="py-1 pr-2"><input aria-label="Field max" type="number" step="any" value={numDisplay(f.maxValue)} onChange={(e) => patchOptionalNum(i, 'maxValue', e.target.value)} className={CELL} /></td>
                <td className="py-1 pr-2 text-center"><input aria-label="Field required" type="checkbox" checked={f.required} onChange={(e) => patch(i, { required: e.target.checked })} className="h-3.5 w-3.5 accent-gold" /></td>
                <td className="py-1 pr-2"><input aria-label="Field enum options" type="text" value={(f.enumOptions ?? []).join(', ')} onChange={(e) => patch(i, { enumOptions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className={CELL} /></td>
                <td className="py-1">
                  <button type="button" aria-label={`Remove field ${f.key || i + 1}`} onClick={() => removeAt(i)} className="rounded-md border border-white/[0.08] p-1 text-muted-foreground/60 transition-colors hover:border-red/40 hover:text-red">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={add} className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]">
        <Plus className="h-3 w-3" strokeWidth={2.5} /> Add field
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Implement `apps/web/components/template-builder.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { TemplateBundle, JobTemplate, JobType, TemplateStageDef, TemplateFieldDef } from '@valor/core';
import { StageDefTable } from '@/components/stage-def-table';
import { FieldDefTable } from '@/components/field-def-table';

export interface TemplateBuilderProps {
  bundles: TemplateBundle[];
  bankCodes: string[];
  onChange: (next: TemplateBundle[]) => void;
}

const CELL =
  'rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const JOB_TYPES: JobType[] = ['drilling', 'completion', 'workover', 'other'];

export function TemplateBuilder({ bundles, bankCodes, onChange }: TemplateBuilderProps) {
  const [selected, setSelected] = useState(0);
  const idx = Math.min(selected, Math.max(0, bundles.length - 1));
  const bundle = bundles[idx];

  const patchBundle = (i: number, next: Partial<TemplateBundle>) => {
    const row = bundles[i];
    if (!row) return;
    const copy = bundles.slice();
    copy[i] = { ...row, ...next };
    onChange(copy);
  };
  const patchTemplate = (i: number, next: Partial<JobTemplate>) => {
    const row = bundles[i];
    if (!row) return;
    patchBundle(i, { template: { ...row.template, ...next } });
  };

  const addTemplate = () => {
    const n = bundles.length + 1;
    const id = `tmpl-new-${n}`;
    const fresh: TemplateBundle = {
      template: { id, orgId: bundle?.template.orgId ?? '', name: `New Template ${n}`, jobType: 'drilling', version: 1, isActive: true },
      stageDefs: [],
      fieldDefs: [],
    };
    onChange([...bundles, fresh]);
    setSelected(bundles.length);
  };
  const removeTemplate = (i: number) => {
    onChange(bundles.filter((_, j) => j !== i));
    setSelected(0);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {bundles.map((b, i) => (
          <button
            key={b.template.id}
            type="button"
            onClick={() => setSelected(i)}
            className={`rounded-md border px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors ${
              i === idx ? 'border-gold/50 bg-gold/[0.12] text-gold-light' : 'border-white/[0.08] text-muted-foreground/70 hover:text-cream'
            }`}
          >
            {b.template.name || '(unnamed)'}
          </button>
        ))}
        <button type="button" onClick={addTemplate} className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]">
          <Plus className="h-3 w-3" strokeWidth={2.5} /> Add template
        </button>
      </div>

      {bundle && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">
              Name
              <input aria-label="Template name" type="text" value={bundle.template.name} onChange={(e) => patchTemplate(idx, { name: e.target.value })} className={`${CELL} w-64`} />
            </label>
            <label className="flex flex-col gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">
              Job type
              <select aria-label="Job type" value={bundle.template.jobType} onChange={(e) => patchTemplate(idx, { jobType: e.target.value as JobType })} className={CELL}>
                {JOB_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">
              <input aria-label="Template active" type="checkbox" checked={bundle.template.isActive} onChange={(e) => patchTemplate(idx, { isActive: e.target.checked })} className="h-3.5 w-3.5 accent-gold" />
              Active
            </label>
            <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/50">v{bundle.template.version}</span>
            <button type="button" aria-label="Remove template" onClick={() => removeTemplate(idx)} className="ml-auto flex items-center gap-1 rounded-md border border-white/[0.08] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground/60 transition-colors hover:border-red/40 hover:text-red">
              <Trash2 className="h-3 w-3" strokeWidth={2} /> Remove template
            </button>
          </div>

          <div>
            <h3 className="mb-2 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light/80">Stages</h3>
            <StageDefTable
              stages={bundle.stageDefs}
              bankCodes={bankCodes}
              templateId={bundle.template.id}
              onChange={(next: TemplateStageDef[]) => patchBundle(idx, { stageDefs: next })}
            />
          </div>

          <div>
            <h3 className="mb-2 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light/80">Field definitions</h3>
            <FieldDefTable
              fields={bundle.fieldDefs}
              templateId={bundle.template.id}
              onChange={(next: TemplateFieldDef[]) => patchBundle(idx, { fieldDefs: next })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run the component test, verify pass**

Run: `corepack pnpm --filter @valor/web test -- template-builder` → PASS (7 tests).

- [ ] **Step 8: Implement `apps/web/app/(hub)/template-builder/page.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import {
  DEFAULT_TEMPLATE_BUNDLES,
  BANK_SEED,
  validateTemplateFieldDefs,
  type TemplateBundle,
} from '@valor/core';
import { getRepo } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TemplateBuilder } from '@/components/template-builder';
import { LoadingState } from '@/components/ui/states';

const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

export default function TemplateBuilderPage() {
  const [bundles, setBundles] = useState<TemplateBundle[]>(DEFAULT_TEMPLATE_BUNDLES);
  const [bankCodes, setBankCodes] = useState<string[]>(BANK_SEED.map((b) => b.code));
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    Promise.all([getRepo().loadTemplateBundles(), getRepo().loadBankCodes()])
      .then(([storedBundles, storedCodes]) => {
        if (!active) return;
        if (storedBundles) setBundles(storedBundles);
        if (storedCodes) setBankCodes(storedCodes.map((b) => b.code));
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const warnings = useMemo(
    () => validateTemplateFieldDefs(bundles.flatMap((b) => b.fieldDefs)),
    [bundles],
  );

  const onSave = async () => {
    if (!loaded || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await getRepo().saveTemplateBundles(bundles);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1800);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2400);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administer · Templates"
        title="Template Builder"
        subtitle="Curate the job/section templates that instantiate Tickets — stages, default Bank codes, and the typed field definitions each template captures."
        actions={
          <button type="button" onClick={onSave} disabled={!loaded || saveState === 'saving'} className={BTN_CLASS}>
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Save'}
          </button>
        }
      />

      {loaded ? (
        <div className="space-y-6">
          {warnings.length > 0 && (
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li key={`${w}-${i}`} className="flex items-start gap-2 rounded-md border border-red/20 bg-red/[0.06] px-3 py-2 text-xs text-red">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <TemplateBuilder bundles={bundles} bankCodes={bankCodes} onChange={setBundles} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <LoadingState />
      )}
    </div>
  );
}
```

- [ ] **Step 9: Verify route + typecheck + full web tests**

Run: `corepack pnpm --filter @valor/web test -- template-builder` → PASS (7).
Run: `corepack pnpm --filter @valor/web test -- planes` → PASS.
Run: `corepack pnpm --filter @valor/web typecheck` → 0.
Run: `corepack pnpm --filter @valor/web test` → all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/web/lib/planes.ts apps/web/__tests__/planes.test.ts apps/web/components/stage-def-table.tsx apps/web/components/field-def-table.tsx apps/web/components/template-builder.tsx "apps/web/app/(hub)/template-builder/page.tsx" apps/web/__tests__/template-builder.test.tsx
git commit -m "feat(web): Template Builder — Administer-plane page + stage/field-def editors"
```

---

### Task 5: Verify — core suite, web, both builds, PR

**Files:** none (verification only)

- [ ] **Step 1: Full core suite + typecheck**

Run: `corepack pnpm --filter @valor/core test` → all pass (the prior suite plus the validateTemplateFieldDefs/DEFAULT_TEMPLATE_BUNDLES + template-bundle persistence tests; treat "all pass" as the contract).
Run: `corepack pnpm --filter @valor/core typecheck` → 0.

- [ ] **Step 2: Web typecheck + tests + normal build**

Run: `corepack pnpm --filter @valor/web typecheck` → 0.
Run: `corepack pnpm --filter @valor/web test` → all pass (+1 todo).
Run: `corepack pnpm --filter @valor/web build` → "Compiled successfully", exit 0.

- [ ] **Step 3: Static-export build (PowerShell)**

```powershell
Remove-Item -Recurse -Force apps/web/.next, apps/web/out -ErrorAction SilentlyContinue
$env:STATIC_EXPORT='true'; $env:PAGES_BASE_PATH='ValorOperations_SB'
corepack pnpm --filter @valor/web build
```
Expected: "Generating static pages (22/22)" (one more than Slice C's 21 — the new `/template-builder`), exit 0, `apps/web/out/template-builder/index.html` emitted. Then clear env: `Remove-Item Env:STATIC_EXPORT,Env:PAGES_BASE_PATH`.

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/template-builder
gh pr create --base master --head feat/template-builder --title "feat: Template + Field-def builder (architecture Slice D)" --body-file <temp: summary + test plan>
```
Then run the standard dual-bot loop (CodeRabbit + Copilot), action-or-justify every finding, re-review after each push, and merge.

---

## Self-Review

**1. Spec coverage:**
- `defaultCode?` on `TemplateStageDef` → Task 1 Step 3 ✓
- `validateTemplateFieldDefs` (empty key/label, enum-no-options, min>max, dup scope:key, defensive) → Task 1 ✓
- `DEFAULT_TEMPLATE_BUNDLES` (1 bundle, 3 stages w/ defaultCode, 5 field-defs) → Task 1 ✓
- Repository `saveTemplateBundles`/`loadTemplateBundles` + MockRepository + snapshot peer + reset → Task 2 ✓
- `local-db/types.ts` snapshot type + COLLECTIONS → Task 2 Step 6 ✓
- SupabaseRepository stubs + listCollections `+2` → Task 3 ✓
- `/template-builder` Administer route (admin) + planes test → Task 4 Step 1 ✓
- StageDefTable (defaultCode datalist), FieldDefTable (scope/type/enum), TemplateBuilder (selector + form), page (load both + validate + save) → Task 4 ✓
- Tests (validate, seed shape, persistence/snapshot, component) → Tasks 1, 2, 4 ✓
- Additive, consumption deferred, both builds → Task 5 ✓

**2. Placeholder scan:** none — every code step has full code; commands have expected output. (Task 5 Step 4 `--body-file` is the standard PR step, filled at execution.)

**3. Type consistency:** `TemplateBundle`/`JobTemplate`/`TemplateStageDef`/`TemplateFieldDef`/`JobType`/`FieldScope`/`FieldDataType` match `@valor/core` exactly. `saveTemplateBundles`/`loadTemplateBundles`, `valor:templatebundles`, `templateBundles` snapshot key, `validateTemplateFieldDefs`, `DEFAULT_TEMPLATE_BUNDLES`, `/template-builder`, `StageDefTable`/`FieldDefTable`/`TemplateBuilder` prop shapes, and the `stage-def-row`/`field-def-row` test ids are consistent across tasks. The page passes `bankCodes: string[]` (from `loadBankCodes`/`BANK_SEED`) to `TemplateBuilder` → `StageDefTable`, matching the component props and the test.
