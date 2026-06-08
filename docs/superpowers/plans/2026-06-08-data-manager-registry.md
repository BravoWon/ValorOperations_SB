# Data Manager Editable Channel Registry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** An editable channel registry (mnemonic + channel assignment + units/precision/source/alarms) as the Data Manager workspace landing.

**Architecture:** Pure `@valor/core` `data-manager` module (`ChannelDef`, `DEFAULT_CHANNELS`, `validateChannels`, `blankChannel`) + repo seam; web adds a registry table + activates the workspace. Mirrors the shipped well-setup pattern.

**Spec:** `docs/superpowers/specs/2026-06-08-data-manager-registry-design.md`

**Conventions:** extensionless imports; pure fns never throw; no `Date.now()`/`Math.random()` in core; repo persistence mirrors `saveWellSetup`; add exports to `index.ts`.

---

## Task 1: Channel types + seed + validation

**Files:** Create `packages/core/src/data-manager/types.ts`, `packages/core/src/data-manager/channels.ts`, `packages/core/test/channels.test.ts`

- [ ] **Step 1: Failing test** (`channels.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_CHANNELS, validateChannels, blankChannel, CHANNEL_SOURCES } from '../src/data-manager/channels';

describe('channels', () => {
  it('seed has unique mnemonics + channelIds', () => {
    expect(new Set(DEFAULT_CHANNELS.map((c) => c.mnemonic)).size).toBe(DEFAULT_CHANNELS.length);
    expect(new Set(DEFAULT_CHANNELS.map((c) => c.channelId)).size).toBe(DEFAULT_CHANNELS.length);
  });
  it('exposes the source set', () => { expect(CHANNEL_SOURCES).toContain('WITS'); });
  it('validate flags duplicate mnemonic', () => {
    const dup = [blankChannel(1), blankChannel(2)].map((c) => ({ ...c, mnemonic: 'X' }));
    expect(validateChannels(dup).some((w) => /mnemonic/i.test(w))).toBe(true);
  });
  it('validate flags min>=max', () => {
    const bad = [{ ...blankChannel(1), mnemonic: 'A', channelId: '1', min: 10, max: 5 }];
    expect(validateChannels(bad).some((w) => /min/i.test(w))).toBe(true);
  });
  it('blankChannel is deterministic by seq', () => {
    expect(blankChannel(3).id).toBe(blankChannel(3).id);
  });
});
```

- [ ] **Step 2:** `corepack pnpm --filter @valor/core test channels` → FAIL.
- [ ] **Step 3: Implement** `types.ts`:

```ts
export type ChannelSource = 'WITS' | 'LAS' | 'Manual' | 'Calc';
export type ChannelDataType = 'number' | 'text';
export interface ChannelDef {
  id: string;
  channelId: string;   // assigned incoming wire/source channel (editable)
  mnemonic: string;    // editable short code
  label: string;
  unit: string;
  dataType: ChannelDataType;
  dp: number;
  source: ChannelSource;
  min: number; max: number;
  alarmLo?: number; alarmHi?: number;
  enabled: boolean;
}
export const CHANNEL_SOURCES: ChannelSource[] = ['WITS', 'LAS', 'Manual', 'Calc'];
```

`channels.ts`:

```ts
import type { ChannelDef } from './types';
export { CHANNEL_SOURCES } from './types';

export const DEFAULT_CHANNELS: ChannelDef[] = [
  { id: 'ch-1',  channelId: '0108', mnemonic: 'BDEP', label: 'Bit Depth',           unit: 'ft',     dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 40000, enabled: true },
  { id: 'ch-2',  channelId: '0110', mnemonic: 'HDEP', label: 'Hole Depth',          unit: 'ft',     dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 40000, enabled: true },
  { id: 'ch-3',  channelId: '0142', mnemonic: 'WOB',  label: 'Weight on Bit',       unit: 'klbf',   dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 100,   alarmHi: 60, enabled: true },
  { id: 'ch-4',  channelId: '0113', mnemonic: 'ROP',  label: 'Rate of Penetration', unit: 'ft/hr',  dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 500,   enabled: true },
  { id: 'ch-5',  channelId: '0120', mnemonic: 'RPM',  label: 'Rotary Speed',        unit: 'rpm',    dataType: 'number', dp: 0, source: 'WITS',   min: 0,   max: 250,   enabled: true },
  { id: 'ch-6',  channelId: '0117', mnemonic: 'TRQ',  label: 'Rotary Torque',       unit: 'kft-lb', dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 50,    alarmHi: 40, enabled: true },
  { id: 'ch-7',  channelId: '0148', mnemonic: 'SPP',  label: 'Standpipe Pressure',  unit: 'psi',    dataType: 'number', dp: 0, source: 'WITS',   min: 0,   max: 7500,  alarmHi: 5000, enabled: true },
  { id: 'ch-8',  channelId: '0124', mnemonic: 'FLWI', label: 'Flow In',             unit: 'gpm',    dataType: 'number', dp: 0, source: 'WITS',   min: 0,   max: 1500,  enabled: true },
  { id: 'ch-9',  channelId: '0125', mnemonic: 'FLWO', label: 'Flow Out',            unit: '%',      dataType: 'number', dp: 0, source: 'WITS',   min: 0,   max: 100,   alarmLo: 20, enabled: true },
  { id: 'ch-10', channelId: '0123', mnemonic: 'SPM1', label: 'Pump 1 Strokes/min',  unit: 'spm',    dataType: 'number', dp: 0, source: 'WITS',   min: 0,   max: 200,   enabled: true },
  { id: 'ch-11', channelId: '0140', mnemonic: 'HKLD', label: 'Hookload',            unit: 'klbf',   dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 600,   enabled: true },
  { id: 'ch-12', channelId: '0171', mnemonic: 'BPOS', label: 'Block Position',      unit: 'ft',     dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 150,   enabled: true },
  { id: 'ch-13', channelId: '0708', mnemonic: 'MWI',  label: 'Mud Weight In',       unit: 'ppg',    dataType: 'number', dp: 1, source: 'Manual', min: 7,   max: 20,    enabled: true },
  { id: 'ch-14', channelId: '0709', mnemonic: 'MWO',  label: 'Mud Weight Out',      unit: 'ppg',    dataType: 'number', dp: 1, source: 'Manual', min: 7,   max: 20,    enabled: true },
  { id: 'ch-15', channelId: '0821', mnemonic: 'TGAS', label: 'Total Gas',           unit: '%',      dataType: 'number', dp: 2, source: 'WITS',   min: 0,   max: 100,   alarmHi: 50, enabled: true },
  { id: 'ch-16', channelId: '5716', mnemonic: 'ECD',  label: 'Equiv. Circ. Density',unit: 'ppg',    dataType: 'number', dp: 2, source: 'Calc',   min: 7,   max: 20,    enabled: true },
];

export function blankChannel(seq: number): ChannelDef {
  return { id: `ch-${seq}`, channelId: '', mnemonic: '', label: '', unit: '', dataType: 'number', dp: 2, source: 'WITS', min: 0, max: 0, enabled: true };
}

export function validateChannels(channels: ChannelDef[]): string[] {
  const warnings: string[] = [];
  const seenM = new Map<string, number>();
  const seenC = new Map<string, number>();
  for (const c of channels) {
    if (c.mnemonic.trim()) seenM.set(c.mnemonic, (seenM.get(c.mnemonic) ?? 0) + 1);
    if (c.channelId.trim()) seenC.set(c.channelId, (seenC.get(c.channelId) ?? 0) + 1);
    if (Number.isFinite(c.min) && Number.isFinite(c.max) && c.min >= c.max) {
      warnings.push(`${c.mnemonic || c.id}: min (${c.min}) must be less than max (${c.max}).`);
    }
    if (!Number.isInteger(c.dp) || c.dp < 0) warnings.push(`${c.mnemonic || c.id}: decimal places must be a non-negative integer.`);
  }
  for (const [m, n] of seenM) if (n > 1) warnings.push(`Duplicate mnemonic "${m}" (${n}×).`);
  for (const [cid, n] of seenC) if (n > 1) warnings.push(`Duplicate channel assignment "${cid}" (${n}×).`);
  return warnings;
}
```

- [ ] **Step 4:** test → PASS. **Step 5:** Commit `feat(core): channel registry types, seed, validation`.

## Task 2: Repository seam (save/load channels)

**Files:** Modify `repository.ts`, `mock-repository.ts`; Create `packages/core/test/mock-repository.channels.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEFAULT_CHANNELS } from '../src/data-manager/channels';

describe('MockRepository channels', () => {
  it('null before save', async () => { expect(await new MockRepository().loadChannels()).toBeNull(); });
  it('round-trips', async () => {
    const r = new MockRepository(); await r.saveChannels(DEFAULT_CHANNELS);
    expect((await r.loadChannels())?.length).toBe(DEFAULT_CHANNELS.length);
  });
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — add to `Repository`:

```ts
saveChannels(channels: import('./data-manager/types').ChannelDef[]): Promise<void>;
loadChannels(): Promise<import('./data-manager/types').ChannelDef[] | null>;
```

In `MockRepository` (mirror `saveWellSetup`, key `valor:channels`):

```ts
private channels: import('./data-manager/types').ChannelDef[] | null = null;
async saveChannels(channels: import('./data-manager/types').ChannelDef[]): Promise<void> {
  const store = this.browserStorage;
  if (store) store.setItem('valor:channels', JSON.stringify(channels));
  else this.channels = structuredClone(channels);
}
async loadChannels(): Promise<import('./data-manager/types').ChannelDef[] | null> {
  const store = this.browserStorage;
  if (store) { const raw = store.getItem('valor:channels'); if (raw) { try { return JSON.parse(raw) as import('./data-manager/types').ChannelDef[]; } catch { return null; } } return null; }
  return this.channels ? structuredClone(this.channels) : null;
}
```

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(core): repository seam for channel save/load`.

## Task 3: Export

**Files:** Modify `packages/core/src/index.ts`

- [ ] Add `export * from './data-manager/types';` and `export * from './data-manager/channels';`. Run full core `test` + `typecheck` (green). Commit `feat(core): export data-manager channels`.

## Task 4: `<ChannelRegistry>`

**Files:** Create `apps/web/components/channel-registry.tsx`, `apps/web/__tests__/channel-registry.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DEFAULT_CHANNELS } from '@valor/core';
import { ChannelRegistry } from '@/components/channel-registry';

it('edits a mnemonic via onChange', () => {
  const onChange = vi.fn();
  const { getAllByLabelText } = render(<ChannelRegistry channels={DEFAULT_CHANNELS} onChange={onChange} />);
  fireEvent.change(getAllByLabelText(/Mnemonic/i)[0], { target: { value: 'WOBX' } });
  expect(onChange).toHaveBeenCalled();
});

it('filters by search', () => {
  const onChange = vi.fn();
  const { getByLabelText, getAllByTestId } = render(<ChannelRegistry channels={DEFAULT_CHANNELS} onChange={onChange} />);
  fireEvent.change(getByLabelText(/search/i), { target: { value: 'ROP' } });
  expect(getAllByTestId('channel-row').length).toBe(1);
});
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — controlled (`channels`, `onChange`). A search input (`aria-label="Search channels"`) filtering rows by mnemonic/label/channelId (case-insensitive). A table; each visible row `data-testid="channel-row"` with editable cells: channelId (text), mnemonic (text, `aria-label="Mnemonic"`), label (text), unit (text), dataType (`<select>` number/text), dp (number), source (`<select>` over `CHANNEL_SOURCES`), min (number), max (number), alarmLo/alarmHi (number), enabled (checkbox), remove button. An "Add channel" button appends `blankChannel(channels.length+1)` (collision-safe via max-id suffix is overkill here — use `Date`-free `ch-${maxSeq+1}`). Editing any cell calls `onChange(next)`. Reuse the well-setup input styling.

- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(web): editable channel registry table`.

## Task 5: `/data-manager` page + activate workspace + nav

**Files:** Create `apps/web/app/(hub)/data-manager/page.tsx`; modify `apps/web/lib/areas.ts`, `apps/web/components/app-shell.tsx`; delete `apps/web/app/(areas)/data-manager/page.tsx`

- [ ] **Step 1: Implement**
  - `lib/areas.ts`: set the `data-manager` area `status: 'active'` (keep `href: '/data-manager'`).
  - Delete `app/(areas)/data-manager/page.tsx` (the coming-soon route) so `/data-manager` resolves to the new hub page.
  - `app/(hub)/data-manager/page.tsx` (`'use client'`): `getRepo().loadChannels()` (fallback `DEFAULT_CHANNELS`); state `channels`; `warnings = validateChannels(channels)`; `PageHeader` ("Data Manager / Channel Registry" + subtitle); `<ChannelRegistry channels onChange>`; a **Save** button → `saveChannels`; the warnings strip (red) like the hydraulics panel; `LoadingState` while loading.
  - `app-shell.tsx`: add a "Data Manager" nav link (Database icon) to `/data-manager`.

- [ ] **Step 2:** `corepack pnpm --filter @valor/web build` → compiles `/data-manager`; `typecheck` 0. **Step 3:** Commit `feat(web): data-manager channel registry page + activate workspace`.

## Task 6: Integrate, verify, ship

- [ ] core `test`+`typecheck`, web `test`+`typecheck`+`build` all green.
- [ ] Restart server on 3210; capture `/data-manager` + launcher screenshots; send for punchlist.
- [ ] Push `feat/data-manager-registry`; open PR (base `master`); action CodeRabbit + Copilot per max-adherence; merge on clean final review.

## Self-Review
- **Spec coverage:** ChannelDef/seed/validation (§1 ✓ T1), repo (§1 ✓ T2), registry table (§2 ✓ T4), page+activate+nav (§2 ✓ T5), DoD (§4 ✓ T6).
- **Type consistency:** `ChannelDef`/`ChannelSource`/`CHANNEL_SOURCES`/`DEFAULT_CHANNELS`/`validateChannels`/`blankChannel`/`saveChannels`/`loadChannels` consistent.
- **No placeholders:** core steps carry full code; web steps carry signatures, `data-testid`/`aria-label` contracts, and tests.
