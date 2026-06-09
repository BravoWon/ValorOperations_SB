# Bank editor (Slice C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Bank (the activity-code catalog) an editable, persisted source of truth with an Admin-plane UI (`/bank-editor`), mirroring the existing Data Manager channel-registry editor exactly.

**Architecture:** A pure `validateBankCodes` helper in `@valor/core`; two additive Repository methods (`saveBankCodes`/`loadBankCodes`) implemented in `MockRepository` (the `valor:bankcodes` localStorage / in-memory pattern) and stubbed (throwing) in `SupabaseRepository`; a new Administer-plane route + a client page + an inline-editable table component on the web side. The catalog is global (not org-scoped), consistent with the other catalogs (channels/vendors/afe).

**Tech Stack:** TypeScript, `@valor/core` (pure, Vitest node), `@valor/web` (Next 15 App Router, React 19, Tailwind, Vitest/jsdom + @testing-library/react). Branch: `feat/bank-editor` (already created). Spec: `docs/superpowers/specs/2026-06-09-bank-editor-design.md`.

**Constraints:** No `Date.now`/`Math.random` in `@valor/core`. `warnings: string[]`, never throw (except the deliberate Supabase stub). Additive — existing tests stay green; `@valor/core` + `@valor/web` typecheck 0; both web builds (normal + static export) pass. MockRepository stays the default. No new brand/personnel/client/well names (IP guardrail).

Commands (from repo root `C:\Users\Deving-1\Desktop\dev\ValorOperations_SB`):
- Core one file: `corepack pnpm --filter @valor/core test -- <name>` · Core all: `corepack pnpm --filter @valor/core test` · Core typecheck: `corepack pnpm --filter @valor/core typecheck`
- Web one file: `corepack pnpm --filter @valor/web test -- <name>` · Web all: `corepack pnpm --filter @valor/web test` · Web typecheck: `corepack pnpm --filter @valor/web typecheck` · Web build: `corepack pnpm --filter @valor/web build`

---

## File Structure
- **Modify `packages/core/src/well-setup/bank.ts`** — add the pure `validateBankCodes`. (Already re-exported via `export * from './well-setup/bank'` in `index.ts`, so `@valor/core` surfaces it with no index change.)
- **Modify `packages/core/src/repository.ts`** — add 2 method signatures to `Repository`.
- **Modify `packages/core/src/mock-repository.ts`** — add `private bankCodes` field, the 2 methods, and one line in `resetLocalDb`.
- **Modify `apps/web/lib/supabase-repository.ts`** — add `BankCode` type import + a throwing-stub helper + 2 stubs.
- **Modify `apps/web/lib/planes.ts`** — register `/bank-editor` under the Administer plane.
- **Create `apps/web/app/(hub)/bank-editor/page.tsx`** — the client page (mirror `data-manager/page.tsx`).
- **Create `apps/web/components/bank-registry.tsx`** — the inline-editable table (mirror `channel-registry.tsx`).
- **Test** `packages/core/test/bank.test.ts` (extend), `packages/core/test/mock-repository.bank.test.ts` (new), `apps/web/__tests__/bank-registry.test.tsx` (new).

---

### Task 1: Core — `validateBankCodes` (pure, warnings[])

**Files:**
- Modify: `packages/core/src/well-setup/bank.ts`
- Test: `packages/core/test/bank.test.ts`

- [ ] **Step 1: Add the failing tests** — append these `it` blocks inside the existing top-level `describe` in `packages/core/test/bank.test.ts` (import `validateBankCodes` + `BANK_SEED` at the top — `BANK_SEED` is likely already imported; add `validateBankCodes` to that import):

```ts
  it('validateBankCodes: clean catalog yields no warnings', () => {
    expect(validateBankCodes(BANK_SEED)).toEqual([]);
  });

  it('validateBankCodes: flags an empty code', () => {
    const w = validateBankCodes([{ code: '  ', label: 'x', category: 'Make Hole', npt: false, billable: true }]);
    expect(w.some((m) => /code cannot be empty/i.test(m))).toBe(true);
  });

  it('validateBankCodes: flags an empty label, naming the code', () => {
    const w = validateBankCodes([{ code: 'DRL', label: '   ', category: 'Make Hole', npt: false, billable: true }]);
    expect(w.some((m) => /DRL: label cannot be empty/i.test(m))).toBe(true);
  });

  it('validateBankCodes: flags duplicate codes case-insensitively with a count', () => {
    const w = validateBankCodes([
      { code: 'DRL', label: 'Drilling', category: 'Make Hole', npt: false, billable: true },
      { code: 'drl', label: 'Drilling 2', category: 'Make Hole', npt: false, billable: true },
    ]);
    expect(w.some((m) => /Duplicate code "DRL" \(2×\)/.test(m))).toBe(true);
  });
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `corepack pnpm --filter @valor/core test -- bank`
Expected: FAIL — `validateBankCodes is not a function` / not exported.

- [ ] **Step 3: Implement `validateBankCodes`** — append to `packages/core/src/well-setup/bank.ts` (after `BANK_CATEGORIES`):

```ts
/** Advisory validation for an edited Bank catalog. Never throws; returns warnings[]. */
export function validateBankCodes(codes: BankCode[]): string[] {
  const warnings: string[] = [];
  // Per-row empties, in array order.
  for (const c of codes) {
    const code = c.code.trim();
    if (!code) warnings.push('Code cannot be empty.');
    if (!c.label.trim()) warnings.push(`${code || '(unnamed)'}: label cannot be empty.`);
  }
  // Duplicate codes (case-insensitive, trimmed), reported in first-seen order.
  const counts = new Map<string, { display: string; n: number }>();
  for (const c of codes) {
    const code = c.code.trim();
    if (!code) continue;
    const key = code.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.n += 1;
    else counts.set(key, { display: code, n: 1 });
  }
  for (const { display, n } of counts.values()) {
    if (n > 1) warnings.push(`Duplicate code "${display}" (${n}×).`);
  }
  return warnings;
}
```

- [ ] **Step 4: Run the tests + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/core test -- bank` → PASS (existing bank tests + 4 new).
Run: `corepack pnpm --filter @valor/core typecheck` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/well-setup/bank.ts packages/core/test/bank.test.ts
git commit -m "feat(core): validateBankCodes — advisory Bank catalog validation (pure)"
```
End the message body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 2: Repository interface + MockRepository persistence

**Files:**
- Modify: `packages/core/src/repository.ts`
- Modify: `packages/core/src/mock-repository.ts`
- Test: `packages/core/test/mock-repository.bank.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/core/test/mock-repository.bank.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { BANK_SEED } from '../src/well-setup/bank';

describe('MockRepository bank codes', () => {
  it('null before save', async () => {
    expect(await new MockRepository().loadBankCodes()).toBeNull();
  });

  it('round-trips and returns an independent clone', async () => {
    const r = new MockRepository();
    await r.saveBankCodes(BANK_SEED);
    const loaded = await r.loadBankCodes();
    expect(loaded?.length).toBe(BANK_SEED.length);
    expect(loaded![0]!.code).toBe(BANK_SEED[0]!.code);
    // mutating the returned array must not change stored state
    loaded![0]!.code = 'MUTATED';
    const again = await r.loadBankCodes();
    expect(again![0]!.code).toBe(BANK_SEED[0]!.code);
  });

  it('resetLocalDb clears persisted bank codes (in-memory path)', async () => {
    const r = new MockRepository();
    await r.saveBankCodes(BANK_SEED);
    await r.resetLocalDb();
    expect(await r.loadBankCodes()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `corepack pnpm --filter @valor/core test -- mock-repository.bank`
Expected: FAIL — `saveBankCodes` is not a function / not on `Repository`.

- [ ] **Step 3: Add the 2 signatures to `packages/core/src/repository.ts`**

Add inside the `Repository` interface, next to the other catalog methods (immediately after the `loadAfe(): Promise<...>` line):

```ts
  saveBankCodes(codes: import('./well-setup/bank').BankCode[]): Promise<void>;
  loadBankCodes(): Promise<import('./well-setup/bank').BankCode[] | null>;
```

- [ ] **Step 4: Add the in-memory field to `MockRepository`**

In `packages/core/src/mock-repository.ts`, add this field immediately after the `private afe: ... | null = null;` line (line ~25, grouped with the other catalog fields):

```ts
  private bankCodes: import('./well-setup/bank').BankCode[] | null = null;
```

- [ ] **Step 5: Add the 2 methods to `MockRepository`**

Add immediately after the `loadAfe` method (after line ~295), mirroring the `saveChannels`/`loadChannels` pattern exactly:

```ts
  async saveBankCodes(codes: import('./well-setup/bank').BankCode[]): Promise<void> {
    const store = this.browserStorage;
    if (store) store.setItem('valor:bankcodes', JSON.stringify(codes));
    else this.bankCodes = structuredClone(codes);
  }

  async loadBankCodes(): Promise<import('./well-setup/bank').BankCode[] | null> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:bankcodes'); if (raw) { try { return JSON.parse(raw) as import('./well-setup/bank').BankCode[]; } catch { return null; } } return null; }
    return this.bankCodes ? structuredClone(this.bankCodes) : null;
  }
```

- [ ] **Step 6: Clear the field in `resetLocalDb`**

In `resetLocalDb`, the in-memory (non-browser) `else` branch currently nulls the catalogs. Add `this.bankCodes = null;` to that line so it reads (keep the existing assignments; just add the bankCodes one):

```ts
      this.channels = null; this.vendors = null; this.afe = null;
      this.bankCodes = null;
      this.codedObjects = null; this.relationsList = null; this.timelines = null;
```

(The browser branch already removes every `valor:`-prefixed key, including `valor:bankcodes`, so no change is needed there. `exportSnapshot`/`importSnapshot` intentionally do not include the Bank catalog — same deferral as the coded-object collections.)

- [ ] **Step 7: Run the test + typecheck, verify pass**

Run: `corepack pnpm --filter @valor/core test -- mock-repository.bank` → PASS (3 tests).
Run: `corepack pnpm --filter @valor/core typecheck` → exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/repository.ts packages/core/src/mock-repository.ts packages/core/test/mock-repository.bank.test.ts
git commit -m "feat(core): Repository + MockRepository bank-code catalog persistence"
```
End the message body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 3: SupabaseRepository throwing stubs

**Files:**
- Modify: `apps/web/lib/supabase-repository.ts`

- [ ] **Step 1: Add the `BankCode` type import**

In the `import { ... } from '@valor/core'` type block in `apps/web/lib/supabase-repository.ts` (the block that already imports `ChannelDef`, `Vendor`, `AfeLine`, `CodedObject`, etc.), add:

```ts
  type BankCode,
```

- [ ] **Step 2: Add a throwing-stub helper + the 2 stubs**

Add these to the `SupabaseRepository` class, immediately after the existing `codedObjectsUnsupported` helper + its coded-object stubs (near the end of the class). They throw because the `bank_codes` cloud table is deferred (Slice C is mock-only):

```ts
  // --- bank-code catalog (Slice C is mock-only; the cloud bank_codes table is a later step) ---
  private bankUnsupported(method: string): never {
    throw new Error(
      `SupabaseRepository.${method}: bank-code catalog not implemented in the Supabase scaffold (Slice C is mock-only).`,
    );
  }
  async saveBankCodes(_codes: BankCode[]): Promise<void> { this.bankUnsupported('saveBankCodes'); }
  async loadBankCodes(): Promise<BankCode[] | null> { this.bankUnsupported('loadBankCodes'); }
```

- [ ] **Step 3: Web typecheck, verify pass**

Run: `corepack pnpm --filter @valor/web typecheck`
Expected: exit 0 (SupabaseRepository satisfies the full `Repository` interface again).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/supabase-repository.ts
git commit -m "feat(web): SupabaseRepository bank-code stubs (throw; Slice C is mock-only)"
```
End the message body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 4: Web — plane registration + page + table component

**Files:**
- Modify: `apps/web/lib/planes.ts`
- Create: `apps/web/components/bank-registry.tsx`
- Create: `apps/web/app/(hub)/bank-editor/page.tsx`
- Test: `apps/web/__tests__/bank-registry.test.tsx`

- [ ] **Step 1: Register the route in `apps/web/lib/planes.ts`**

Add `Tags` to the `lucide-react` import (the line importing `Database, Building2, BarChart3, HardDrive,`), so it becomes:

```ts
  Database, Building2, BarChart3, HardDrive, Tags,
```

Then add the Bank Editor item to the Administer plane's `items` array, between Data Manager and Office Ops:

```ts
      { href: '/data-manager', label: 'Data Manager', icon: Database, minRole: 'admin' },
      { href: '/bank-editor', label: 'Bank Editor', icon: Tags, minRole: 'admin' },
      { href: '/office-ops', label: 'Office Ops', icon: Building2, minRole: 'admin' },
```

- [ ] **Step 2: Write the failing component test** — create `apps/web/__tests__/bank-registry.test.tsx` (mirrors `channel-registry.test.tsx`):

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { BANK_SEED, BANK_CATEGORIES } from '@valor/core';
import { BankRegistry } from '@/components/bank-registry';

describe('BankRegistry', () => {
  it('edits a label via onChange', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.change(getAllByLabelText(/^Label$/i)[0] as HTMLInputElement, { target: { value: 'Drilling Ahead' } });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].label).toBe('Drilling Ahead');
  });

  it('upper-cases the code on input', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.change(getAllByLabelText(/^Code$/i)[0] as HTMLInputElement, { target: { value: 'abc' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].code).toBe('ABC');
  });

  it('toggles NPT via the checkbox', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.click(getAllByLabelText(/NPT/i)[0] as HTMLInputElement);
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].npt).toBe(!BANK_SEED[0]!.npt);
  });

  it('offers existing categories as datalist options', () => {
    const onChange = vi.fn();
    const { container } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    const options = container.querySelectorAll('datalist option');
    expect(options.length).toBe(BANK_CATEGORIES.length);
  });

  it('adds a blank row', () => {
    const onChange = vi.fn();
    const { getByText } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.click(getByText(/Add code/i));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.length).toBe(BANK_SEED.length + 1);
    expect(next.at(-1)).toEqual({ code: '', label: '', category: BANK_CATEGORIES[0] ?? '', npt: false, billable: false });
  });

  it('removes a row', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.click(getAllByLabelText(/Remove/i)[0] as HTMLElement);
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.length).toBe(BANK_SEED.length - 1);
    expect(next.some((c: { code: string }) => c.code === BANK_SEED[0]!.code)).toBe(false);
  });

  it('filters by search', () => {
    const onChange = vi.fn();
    const { getByLabelText, getAllByTestId } = render(<BankRegistry codes={BANK_SEED} onChange={onChange} />);
    fireEvent.change(getByLabelText(/search/i), { target: { value: 'STUCK' } });
    expect(getAllByTestId('bank-code-row').length).toBe(1);
  });
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `corepack pnpm --filter @valor/web test -- bank-registry`
Expected: FAIL — cannot resolve `@/components/bank-registry`.

- [ ] **Step 4: Implement `apps/web/components/bank-registry.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { BANK_CATEGORIES, type BankCode } from '@valor/core';

export interface BankRegistryProps {
  codes: BankCode[];
  onChange: (next: BankCode[]) => void;
}

const CELL_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-xs text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';
const SEARCH_INPUT_CLASS =
  'w-full rounded-md border border-white/[0.08] bg-background/40 py-1.5 pl-8 pr-2.5 font-mono text-sm text-cream outline-none transition-colors focus:border-gold/50 focus:bg-background/60';

const CATEGORY_LIST_ID = 'bank-categories';

const COLUMNS: { key: string; label: string }[] = [
  { key: 'code', label: 'Code' },
  { key: 'label', label: 'Label' },
  { key: 'category', label: 'Category' },
  { key: 'npt', label: 'NPT' },
  { key: 'billable', label: 'Billable' },
];

export function BankRegistry({ codes, onChange }: BankRegistryProps) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return codes.map((c, i) => ({ c, i }));
    return codes
      .map((c, i) => ({ c, i }))
      .filter(
        ({ c }) =>
          c.code.toLowerCase().includes(q) ||
          c.label.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q),
      );
  }, [codes, q]);

  const patch = (i: number, next: Partial<BankCode>) => {
    const row = codes[i];
    if (!row) return;
    const copy = codes.slice();
    copy[i] = { ...row, ...next };
    onChange(copy);
  };

  const removeAt = (i: number) => onChange(codes.filter((_, j) => j !== i));

  const addCode = () =>
    onChange([...codes, { code: '', label: '', category: BANK_CATEGORIES[0] ?? '', npt: false, billable: false }]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50"
          strokeWidth={2}
          aria-hidden="true"
        />
        <input
          type="text"
          aria-label="Search codes"
          placeholder="Search codes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={SEARCH_INPUT_CLASS}
        />
      </div>

      <datalist id={CATEGORY_LIST_ID}>
        {BANK_CATEGORIES.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="pb-1.5 pr-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70"
                >
                  {col.label}
                </th>
              ))}
              <th className="w-8 pb-1.5" />
            </tr>
          </thead>
          <tbody>
            {visible.map(({ c, i }) => (
              <tr key={c.code || i} data-testid="bank-code-row" className="border-t border-white/[0.05]">
                <td className="py-1 pr-2">
                  <input
                    aria-label="Code"
                    type="text"
                    value={c.code}
                    onChange={(e) => patch(i, { code: e.target.value.toUpperCase() })}
                    className={CELL_INPUT_CLASS}
                    maxLength={12}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Label"
                    type="text"
                    value={c.label}
                    onChange={(e) => patch(i, { label: e.target.value })}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Category"
                    type="text"
                    list={CATEGORY_LIST_ID}
                    value={c.category}
                    onChange={(e) => patch(i, { category: e.target.value })}
                    className={CELL_INPUT_CLASS}
                  />
                </td>
                <td className="py-1 pr-2 text-center">
                  <input
                    aria-label="NPT"
                    type="checkbox"
                    checked={c.npt}
                    onChange={(e) => patch(i, { npt: e.target.checked })}
                    className="h-3.5 w-3.5 accent-gold"
                  />
                </td>
                <td className="py-1 pr-2 text-center">
                  <input
                    aria-label="Billable"
                    type="checkbox"
                    checked={c.billable}
                    onChange={(e) => patch(i, { billable: e.target.checked })}
                    className="h-3.5 w-3.5 accent-gold"
                  />
                </td>
                <td className="py-1">
                  <button
                    type="button"
                    aria-label={`Remove ${c.code || 'code'}`}
                    onClick={() => removeAt(i)}
                    className="rounded-md border border-white/[0.08] p-1 text-muted-foreground/60 transition-colors hover:border-red/40 hover:text-red"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addCode}
        className="flex items-center gap-1 rounded-md border border-gold/30 bg-gold/[0.06] px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} />
        Add code
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Run the component test, verify pass**

Run: `corepack pnpm --filter @valor/web test -- bank-registry` → PASS (7 tests).

- [ ] **Step 6: Implement `apps/web/app/(hub)/bank-editor/page.tsx`** (mirror `data-manager/page.tsx`)

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { BANK_SEED, validateBankCodes, type BankCode } from '@valor/core';
import { getRepo } from '@/lib/repo';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BankRegistry } from '@/components/bank-registry';
import { LoadingState } from '@/components/ui/states';

const BTN_CLASS =
  'flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40';

export default function BankEditorPage() {
  const [codes, setCodes] = useState<BankCode[]>(BANK_SEED);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load persisted bank codes on mount (fall back to the seed catalog).
  useEffect(() => {
    let active = true;
    getRepo()
      .loadBankCodes()
      .then((stored) => {
        if (!active) return;
        if (stored) setCodes(stored);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const warnings = useMemo(() => validateBankCodes(codes), [codes]);

  const onSave = async () => {
    setSaveState('saving');
    await getRepo().saveBankCodes(codes);
    setSaveState('saved');
    setTimeout(() => setSaveState('idle'), 1800);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administer · The Bank"
        title="Bank Editor"
        subtitle="The editable activity-code catalog every plane consumes — set each code's label, category, NPT flag, and billable flag."
        actions={
          <button type="button" onClick={onSave} disabled={saveState === 'saving'} className={BTN_CLASS}>
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save'}
          </button>
        }
      />

      {loaded ? (
        <div className="space-y-6">
          {warnings.length > 0 && (
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li
                  key={`${w}-${i}`}
                  className="flex items-start gap-2 rounded-md border border-red/20 bg-red/[0.06] px-3 py-2 text-xs text-red"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Activity Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <BankRegistry codes={codes} onChange={setCodes} />
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

- [ ] **Step 7: Verify the route, typecheck, full web tests**

Run: `corepack pnpm --filter @valor/web test -- bank-registry` → PASS (7).
Run: `corepack pnpm --filter @valor/web typecheck` → exit 0.
Run: `corepack pnpm --filter @valor/web test` → all pass (existing + 7 new).

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/planes.ts apps/web/components/bank-registry.tsx "apps/web/app/(hub)/bank-editor/page.tsx" apps/web/__tests__/bank-registry.test.tsx
git commit -m "feat(web): Bank Editor — Administer-plane page + inline-editable catalog table"
```
End the message body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 5: Verify — core suite, web, both builds, PR

**Files:** none (verification only)

- [ ] **Step 1: Full core suite + typecheck**

Run: `corepack pnpm --filter @valor/core test` → all pass (178 existing + 4 + 3 new = 185).
Run: `corepack pnpm --filter @valor/core typecheck` → exit 0.

- [ ] **Step 2: Web typecheck + tests + normal build**

Run: `corepack pnpm --filter @valor/web typecheck` → exit 0.
Run: `corepack pnpm --filter @valor/web test` → all pass (117 + 7 new = 124, +1 todo).
Run: `corepack pnpm --filter @valor/web build` → "Compiled successfully", exit 0.

- [ ] **Step 3: Static-export build (PowerShell, no MSYS path-mangling)**

```powershell
Remove-Item -Recurse -Force apps/web/.next, apps/web/out -ErrorAction SilentlyContinue
$env:STATIC_EXPORT='true'; $env:PAGES_BASE_PATH='ValorOperations_SB'
corepack pnpm --filter @valor/web build
```
Expected: "Generating static pages (21/21)" (one more page than before — the new `/bank-editor`), exit 0, `apps/web/out/` emitted. Then clear the env: `Remove-Item Env:STATIC_EXPORT,Env:PAGES_BASE_PATH`.

- [ ] **Step 4: Push + open PR**

```bash
git push -u origin feat/bank-editor
gh pr create --base master --head feat/bank-editor --title "feat: Bank editor — editable persisted code catalog (architecture Slice C)" --body-file <temp file: summary + test plan>
```
Then run the standard dual-bot review loop (CodeRabbit + Copilot), action-or-justify every finding, re-review after each push, and merge.

---

## Self-Review

**1. Spec coverage:**
- `validateBankCodes` (pure, warnings: empty code / empty label / dup) → Task 1 ✓
- Repository `saveBankCodes`/`loadBankCodes` + MockRepository (`valor:bankcodes`, in-memory, reset) → Task 2 ✓
- SupabaseRepository throwing stubs (keep web typecheck) → Task 3 ✓
- `/bank-editor` registered under Administer (minRole admin) → Task 4 Step 1 ✓
- Page (load-on-mount + seed fallback, LoadingState, warnings, Save feedback) → Task 4 Step 6 ✓
- `BankRegistry` table (search, code upper-case, category datalist, npt/billable, add/remove, aria-labels) → Task 4 Step 4 ✓
- Tests (validateBankCodes, repo round-trip/reset, component) → Tasks 1, 2, 4 ✓
- Catalog global (no orgId) → methods take no orgId ✓
- Pure/deterministic, additive, both builds → Task 5 ✓
- Out of scope (live-catalog wiring, cloud table, category mgmt) honored — not built ✓

**2. Placeholder scan:** none — every code step shows full code; commands have expected output. (Task 5 Step 4's `--body-file` is the standard PR step, filled at execution.)

**3. Type consistency:** `BankCode` shape (`code/label/category/npt/billable`) is identical across `bank.ts`, the repo signatures, the Mock impl, the Supabase stub, the page, the component, and all tests. Method names `saveBankCodes`/`loadBankCodes`, the `validateBankCodes` signature, the storage key `valor:bankcodes`, the route `/bank-editor`, the `data-testid="bank-code-row"`, and the `BankRegistry`/`BankRegistryProps` names match everywhere they appear.
