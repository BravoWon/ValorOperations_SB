# Well Setup → Live Wellbore Diagram → Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define coded, customizable well-setup inputs that project to a live, unit-flippable SVG wellbore schematic exportable to PNG/print — slice 1 of the operations-hub engine.

**Architecture:** Pure `@valor/core` modules (units · bank · well-setup types/field-defs · `projectWellbore` · repo seam) drive registry-rendered React panels + an SVG `<WellboreSchematic>`; persistence flows through the existing `Repository` seam (mock/localStorage). Mirrors the proven `computeHydraulics` + hydraulics-panel pattern.

**Tech Stack:** TypeScript, Vitest (core, node), @testing-library/react + jsdom (web), Next 15 App Router, React 19, Tailwind, Valor brand utilities.

**Spec:** `docs/superpowers/specs/2026-06-07-well-setup-diagram-export-design.md`

**Conventions to follow:** extensionless imports (moduleResolution bundler); pure compute returns a `warnings: string[]` and never throws on bad input (see `compute/hydraulics.ts`); field-spec registries drive the UI (`HYDRAULICS_FIELDS` pattern); repo persistence uses `globalThis.localStorage` with an in-memory `Map` fallback (see `MockRepository` dashboard methods); all new core exports added to `packages/core/src/index.ts`.

---

## File Structure

- `packages/core/src/units/units.ts` — canonical-SI length units + `convertLength`/`formatLength`.
- `packages/core/src/well-setup/bank.ts` — coded catalog (the Bank): `BankCode` + `BANK_SEED` + lookups.
- `packages/core/src/well-setup/types.ts` — `WellSetup`, rows, `WellboreModel`, enums.
- `packages/core/src/well-setup/field-defs.ts` — `HEADER_FIELDS`, `*_COLUMNS`, `DEFAULT_WELL_SETUP`.
- `packages/core/src/well-setup/project-wellbore.ts` — `projectWellbore(setup) → WellboreModel`.
- `packages/core/src/repository.ts` (modify) + `mock-repository.ts` (modify) — `saveWellSetup`/`loadWellSetup`.
- `packages/core/src/index.ts` (modify) — export the new modules.
- `apps/web/lib/export-diagram.ts` — SVG → PNG download + print helper.
- `apps/web/components/wellbore-schematic.tsx` — the SVG diagram.
- `apps/web/components/well-setup-panels.tsx` — registry-driven inputs + Bank code picker + unit selectors.
- `apps/web/app/wells/[wellId]/setup/page.tsx` — the slice-1 screen.
- Tests colocated: `*.test.ts` (core, `src/**`), `apps/web/__tests__/*.test.tsx` (web).

---

## Task 1: Units module (canonical SI, length flipping)

**Files:** Create `packages/core/src/units/units.ts`, `packages/core/src/units/units.test.ts`

- [ ] **Step 1: Failing test** (`units.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { convertLength, formatLength, LENGTH_UNITS } from './units';

describe('convertLength', () => {
  it('round-trips in↔mm', () => { expect(convertLength(1, 'in', 'mm')).toBeCloseTo(25.4, 6); });
  it('converts ft→m', () => { expect(convertLength(10, 'ft', 'm')).toBeCloseTo(3.048, 6); });
  it('identity', () => { expect(convertLength(5.5, 'in', 'in')).toBe(5.5); });
  it('passes non-finite through', () => { expect(Number.isNaN(convertLength(NaN, 'ft', 'm'))).toBe(true); });
  it('exposes all six length units', () => { expect(LENGTH_UNITS).toEqual(['mm','cm','in','ft','yd','m']); });
});
describe('formatLength', () => {
  it('formats with unit + decimals', () => { expect(formatLength(3.048, 'm', 3)).toBe('3.048 m'); });
});
```

- [ ] **Step 2:** Run `corepack pnpm --filter @valor/core test units` → FAIL (module missing).
- [ ] **Step 3: Implement** (`units.ts`)

```ts
export type LengthUnit = 'mm' | 'cm' | 'in' | 'ft' | 'yd' | 'm';
export const LENGTH_UNITS: LengthUnit[] = ['mm', 'cm', 'in', 'ft', 'yd', 'm'];

// Canonical = meters. Convert via canonical to keep one source of truth.
const METERS_PER: Record<LengthUnit, number> = { mm: 0.001, cm: 0.01, in: 0.0254, ft: 0.3048, yd: 0.9144, m: 1 };

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  if (!Number.isFinite(value)) return value;
  if (from === to) return value;
  return (value * METERS_PER[from]) / METERS_PER[to];
}

export function formatLength(value: number, unit: LengthUnit, decimals = 2): string {
  if (!Number.isFinite(value)) return `— ${unit}`;
  return `${value.toFixed(decimals)} ${unit}`;
}
```

- [ ] **Step 4:** Run test → PASS.
- [ ] **Step 5:** Commit `feat(core): canonical-SI length units + flipping`.

## Task 2: Bank (coded catalog)

**Files:** Create `packages/core/src/well-setup/bank.ts`, `bank.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { BANK_SEED, findBankCode, listBankByCategory } from './bank';

describe('Bank', () => {
  it('has unique codes', () => {
    const codes = BANK_SEED.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it('finds a code', () => { expect(findBankCode(BANK_SEED[0].code)?.label).toBeTruthy(); });
  it('flags NPT trouble activities', () => {
    expect(BANK_SEED.some((b) => b.npt)).toBe(true);
  });
  it('lists by category', () => {
    const cat = BANK_SEED[0].category;
    expect(listBankByCategory(cat).every((b) => b.category === cat)).toBe(true);
  });
});
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** (`bank.ts`) — generic, brand-free codes abstracted from the standard activity catalog (no proprietary source). Include ~14 codes across categories with `npt`/`billable` flags:

```ts
export interface BankCode {
  code: string;        // selected code, e.g. 'DRL'
  label: string;       // human label
  category: string;    // 'Make Hole' | 'Pipe Movement' | 'Casing/Cement' | 'Pressure/BOP' | 'Evaluation' | 'Trouble (NPT)' | 'Service'
  npt: boolean;        // true = non-productive time
  billable: boolean;
}

export const BANK_SEED: BankCode[] = [
  { code: 'DRL', label: 'Drilling', category: 'Make Hole', npt: false, billable: true },
  { code: 'CONN', label: 'Connection', category: 'Make Hole', npt: false, billable: true },
  { code: 'REAM', label: 'Reaming', category: 'Make Hole', npt: false, billable: true },
  { code: 'TIH', label: 'Tripping In', category: 'Pipe Movement', npt: false, billable: true },
  { code: 'TOH', label: 'Tripping Out', category: 'Pipe Movement', npt: false, billable: true },
  { code: 'CIRC', label: 'Circulating', category: 'Make Hole', npt: false, billable: true },
  { code: 'CSG', label: 'Run Casing', category: 'Casing/Cement', npt: false, billable: true },
  { code: 'CMT', label: 'Cementing', category: 'Casing/Cement', npt: false, billable: true },
  { code: 'WOC', label: 'Wait on Cement', category: 'Casing/Cement', npt: false, billable: true },
  { code: 'BOP', label: 'Nipple Up / Test BOP', category: 'Pressure/BOP', npt: false, billable: true },
  { code: 'SVY', label: 'Survey / Directional', category: 'Evaluation', npt: false, billable: true },
  { code: 'RIGREP', label: 'Rig Repair', category: 'Trouble (NPT)', npt: true, billable: false },
  { code: 'STUCK', label: 'Stuck Pipe', category: 'Trouble (NPT)', npt: true, billable: false },
  { code: 'WOW', label: 'Wait on Weather', category: 'Trouble (NPT)', npt: true, billable: false },
];

export function findBankCode(code: string): BankCode | undefined {
  return BANK_SEED.find((b) => b.code === code);
}
export function listBankByCategory(category: string): BankCode[] {
  return BANK_SEED.filter((b) => b.category === category);
}
export const BANK_CATEGORIES: string[] = [...new Set(BANK_SEED.map((b) => b.category))];
```

- [ ] **Step 4:** Run → PASS.  **Step 5:** Commit `feat(core): coded Bank catalog seed`.

## Task 3: Well-setup types + field-defs + defaults

**Files:** Create `packages/core/src/well-setup/types.ts`, `field-defs.ts`, `field-defs.test.ts`

- [ ] **Step 1: Failing test** (`field-defs.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { HEADER_FIELDS, CASING_COLUMNS, DEFAULT_WELL_SETUP } from './field-defs';
import { findBankCode } from './bank';

describe('well-setup field-defs', () => {
  it('header includes a code field bound to the Bank', () => {
    const codeField = HEADER_FIELDS.find((f) => f.kind === 'code');
    expect(codeField?.key).toBe('jobCode');
  });
  it('default setup uses a real Bank code', () => {
    expect(findBankCode(DEFAULT_WELL_SETUP.header.jobCode)).toBeTruthy();
  });
  it('default has ordered casing strings', () => {
    expect(DEFAULT_WELL_SETUP.casings.length).toBeGreaterThanOrEqual(2);
  });
  it('every casing column has a key+label', () => {
    expect(CASING_COLUMNS.every((c) => c.key && c.label)).toBe(true);
  });
});
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** (`types.ts`)

```ts
export type WellStatus = 'planned' | 'in_progress' | 'complete';

export interface WellSetupHeader {
  jobCode: string;          // FK → Bank
  wellApi: string;
  rig: string;
  wellName: string;
  section: string;          // Conductor | Surface | Intermediate | Production | ...
  diameterIn: number;       // canonical: inches
  status: WellStatus;
  plannedStart: string; plannedStop: string;
  actualStart: string; actualStop: string;
}
export interface CasingRow {
  role: string; odIn: number; idIn: number; weightPpf: number; grade: string;
  connection: string; shoeMdFt: number; shoeTvdFt: number; tocFt: number;
}
export interface HoleRow { name: string; bitDiaIn: number; topFt: number; bottomFt: number; }
export interface FormationRow { name: string; topFt: number; bottomFt: number; }
export interface WellSetup {
  header: WellSetupHeader; casings: CasingRow[]; holes: HoleRow[]; formations: FormationRow[];
}
export interface WellboreModel {
  header: WellSetupHeader & { codeLabel: string };
  totalDepthFt: number;
  casings: CasingRow[];     // sorted outer→inner (od desc)
  holes: HoleRow[];         // sorted by top asc
  formations: FormationRow[]; // sorted by top asc
  warnings: string[];
}
```

Then `field-defs.ts` (specs + a generic, brand-free default seed — section names/grades are public standards only):

```ts
import type { WellSetup, WellSetupHeader, WellStatus } from './types';

export type FieldKind = 'text' | 'number' | 'code' | 'enum' | 'datetime';
export interface HeaderFieldSpec {
  key: keyof WellSetupHeader; label: string; kind: FieldKind;
  unitQuantity?: 'length'; options?: readonly string[]; group: string;
}
export const SECTION_NAMES = ['Conductor', 'Surface', 'Intermediate', 'Production'] as const;
export const WELL_STATUSES: readonly WellStatus[] = ['planned', 'in_progress', 'complete'];

export const HEADER_FIELDS: HeaderFieldSpec[] = [
  { key: 'jobCode', label: 'Job code', kind: 'code', group: 'Identity' },
  { key: 'wellApi', label: 'Well API / UWI', kind: 'text', group: 'Identity' },
  { key: 'rig', label: 'Rig', kind: 'text', group: 'Identity' },
  { key: 'wellName', label: 'Well name', kind: 'text', group: 'Identity' },
  { key: 'section', label: 'Section', kind: 'enum', options: SECTION_NAMES, group: 'Section' },
  { key: 'diameterIn', label: 'Diameter', kind: 'number', unitQuantity: 'length', group: 'Section' },
  { key: 'status', label: 'Status', kind: 'enum', options: WELL_STATUSES, group: 'Section' },
  { key: 'plannedStart', label: 'Planned start', kind: 'datetime', group: 'Schedule' },
  { key: 'plannedStop', label: 'Planned stop', kind: 'datetime', group: 'Schedule' },
  { key: 'actualStart', label: 'Actual start', kind: 'datetime', group: 'Schedule' },
  { key: 'actualStop', label: 'Actual stop', kind: 'datetime', group: 'Schedule' },
];

export interface ColumnSpec { key: string; label: string; kind: FieldKind; unitQuantity?: 'length'; }
export const CASING_COLUMNS: ColumnSpec[] = [
  { key: 'role', label: 'Role', kind: 'text' },
  { key: 'odIn', label: 'OD', kind: 'number', unitQuantity: 'length' },
  { key: 'idIn', label: 'ID', kind: 'number', unitQuantity: 'length' },
  { key: 'weightPpf', label: 'Weight (lb/ft)', kind: 'number' },
  { key: 'grade', label: 'Grade', kind: 'text' },
  { key: 'connection', label: 'Connection', kind: 'text' },
  { key: 'shoeMdFt', label: 'Shoe MD', kind: 'number', unitQuantity: 'length' },
  { key: 'shoeTvdFt', label: 'Shoe TVD', kind: 'number', unitQuantity: 'length' },
  { key: 'tocFt', label: 'TOC', kind: 'number', unitQuantity: 'length' },
];
export const HOLE_COLUMNS: ColumnSpec[] = [
  { key: 'name', label: 'Section', kind: 'text' },
  { key: 'bitDiaIn', label: 'Bit dia', kind: 'number', unitQuantity: 'length' },
  { key: 'topFt', label: 'Top', kind: 'number', unitQuantity: 'length' },
  { key: 'bottomFt', label: 'Bottom', kind: 'number', unitQuantity: 'length' },
];
export const FORMATION_COLUMNS: ColumnSpec[] = [
  { key: 'name', label: 'Formation', kind: 'text' },
  { key: 'topFt', label: 'Top', kind: 'number', unitQuantity: 'length' },
  { key: 'bottomFt', label: 'Bottom', kind: 'number', unitQuantity: 'length' },
];

export const DEFAULT_WELL_SETUP: WellSetup = {
  header: {
    jobCode: 'DRL', wellApi: '00-000-00000', rig: 'Rig 1', wellName: 'Demo Well 1',
    section: 'Production', diameterIn: 8.5, status: 'in_progress',
    plannedStart: '2026-06-07T06:00', plannedStop: '2026-06-12T06:00', actualStart: '2026-06-07T07:30', actualStop: '',
  },
  casings: [
    { role: 'Conductor', odIn: 13.375, idIn: 12.615, weightPpf: 54, grade: 'H-40', connection: 'STC', shoeMdFt: 114, shoeTvdFt: 114, tocFt: 0 },
    { role: 'Surface', odIn: 9.625, idIn: 8.835, weightPpf: 40, grade: 'J-55', connection: 'LTC', shoeMdFt: 2114, shoeTvdFt: 2114, tocFt: 0 },
    { role: 'Production', odIn: 5.5, idIn: 4.95, weightPpf: 17, grade: 'L-80', connection: 'BTC', shoeMdFt: 6400, shoeTvdFt: 6380, tocFt: 1944 },
  ],
  holes: [
    { name: 'Surface', bitDiaIn: 12.25, topFt: 114, bottomFt: 2114 },
    { name: 'Production', bitDiaIn: 8.5, topFt: 2114, bottomFt: 6400 },
  ],
  formations: [
    { name: 'Upper Shale', topFt: 1500, bottomFt: 1944 },
    { name: 'Limestone A', topFt: 1944, bottomFt: 2400 },
    { name: 'Target Sand', topFt: 6100, bottomFt: 6380 },
  ],
};
```

- [ ] **Step 4:** Run → PASS.  **Step 5:** Commit `feat(core): well-setup types, field-defs, default seed`.

## Task 4: `projectWellbore`

**Files:** Create `packages/core/src/well-setup/project-wellbore.ts`, `project-wellbore.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { projectWellbore } from './project-wellbore';
import { DEFAULT_WELL_SETUP } from './field-defs';

describe('projectWellbore', () => {
  it('sorts casings outer→inner by OD', () => {
    const m = projectWellbore(DEFAULT_WELL_SETUP);
    const ods = m.casings.map((c) => c.odIn);
    expect(ods).toEqual([...ods].sort((a, b) => b - a));
  });
  it('totalDepth = deepest shoe/hole bottom', () => {
    const m = projectWellbore(DEFAULT_WELL_SETUP);
    expect(m.totalDepthFt).toBe(6400);
  });
  it('resolves the code label from the Bank', () => {
    const m = projectWellbore(DEFAULT_WELL_SETUP);
    expect(m.header.codeLabel).toBe('Drilling');
  });
  it('warns when a casing shoe is deeper than total hole', () => {
    const bad = structuredClone(DEFAULT_WELL_SETUP);
    bad.casings[2].shoeMdFt = 9999;
    expect(projectWellbore(bad).warnings.some((w) => /shoe/i.test(w))).toBe(true);
  });
  it('warns on unknown code', () => {
    const bad = structuredClone(DEFAULT_WELL_SETUP);
    bad.header.jobCode = 'ZZZ';
    expect(projectWellbore(bad).warnings.some((w) => /code/i.test(w))).toBe(true);
  });
});
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement**

```ts
import type { WellSetup, WellboreModel } from './types';
import { findBankCode } from './bank';

export function projectWellbore(setup: WellSetup): WellboreModel {
  const warnings: string[] = [];
  const code = findBankCode(setup.header.jobCode);
  if (!code) warnings.push(`Job code "${setup.header.jobCode}" is not in the Bank.`);

  const casings = [...setup.casings].sort((a, b) => b.odIn - a.odIn);
  const holes = [...setup.holes].sort((a, b) => a.topFt - b.topFt);
  const formations = [...setup.formations].sort((a, b) => a.topFt - b.topFt);

  const depths = [
    ...casings.map((c) => c.shoeMdFt),
    ...holes.map((h) => h.bottomFt),
    ...formations.map((f) => f.bottomFt),
  ].filter((d) => Number.isFinite(d));
  const totalDepthFt = depths.length ? Math.max(...depths) : 0;

  const holeBottom = holes.length ? Math.max(...holes.map((h) => h.bottomFt)) : totalDepthFt;
  for (const c of casings) {
    if (Number.isFinite(c.shoeMdFt) && holeBottom > 0 && c.shoeMdFt > holeBottom) {
      warnings.push(`${c.role} shoe (${c.shoeMdFt} ft) is below the deepest hole section (${holeBottom} ft).`);
    }
    if (c.idIn >= c.odIn) warnings.push(`${c.role} ID must be smaller than OD.`);
  }

  return {
    header: { ...setup.header, codeLabel: code?.label ?? setup.header.jobCode },
    totalDepthFt, casings, holes, formations, warnings,
  };
}
```

- [ ] **Step 4:** Run → PASS.  **Step 5:** Commit `feat(core): projectWellbore projection + warnings`.

## Task 5: Repository seam (save/load well setup)

**Files:** Modify `packages/core/src/repository.ts`, `mock-repository.ts`; Create `mock-repository.wellsetup.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { MockRepository } from './mock-repository';
import { DEFAULT_WELL_SETUP } from './well-setup/field-defs';

describe('MockRepository well setup', () => {
  it('returns null before any save', async () => {
    const repo = new MockRepository();
    expect(await repo.loadWellSetup('well-x')).toBeNull();
  });
  it('round-trips save/load (in-memory fallback)', async () => {
    const repo = new MockRepository();
    await repo.saveWellSetup('well-x', DEFAULT_WELL_SETUP);
    const loaded = await repo.loadWellSetup('well-x');
    expect(loaded?.header.wellName).toBe(DEFAULT_WELL_SETUP.header.wellName);
  });
});
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — add to `Repository` interface:

```ts
saveWellSetup(wellId: string, setup: import('./well-setup/types').WellSetup): Promise<void>;
loadWellSetup(wellId: string): Promise<import('./well-setup/types').WellSetup | null>;
```

In `MockRepository` (mirror the dashboard localStorage+Map pattern):

```ts
private wellSetups = new Map<string, import('./well-setup/types').WellSetup>();
private wellSetupKey(id: string) { return `valor:wellsetup:${id}`; }

async saveWellSetup(wellId: string, setup: import('./well-setup/types').WellSetup): Promise<void> {
  const store = this.browserStorage;
  if (store) store.setItem(this.wellSetupKey(wellId), JSON.stringify(setup));
  else this.wellSetups.set(wellId, structuredClone(setup));
}
async loadWellSetup(wellId: string): Promise<import('./well-setup/types').WellSetup | null> {
  const store = this.browserStorage;
  if (store) {
    const raw = store.getItem(this.wellSetupKey(wellId));
    if (raw) { try { return JSON.parse(raw) as import('./well-setup/types').WellSetup; } catch { return null; } }
    return null;
  }
  return this.wellSetups.has(wellId) ? structuredClone(this.wellSetups.get(wellId)!) : null;
}
```

- [ ] **Step 4:** Run → PASS.  **Step 5:** Commit `feat(core): repository seam for well-setup save/load`.

## Task 6: Export core modules

**Files:** Modify `packages/core/src/index.ts`

- [ ] **Step 1:** Add exports, then run the full core suite.

```ts
export * from './units/units';
export * from './well-setup/types';
export * from './well-setup/bank';
export * from './well-setup/field-defs';
export * from './well-setup/project-wellbore';
```

- [ ] **Step 2:** Run `corepack pnpm --filter @valor/core test` → ALL PASS; `corepack pnpm --filter @valor/core build` clean.
- [ ] **Step 3:** Commit `feat(core): export well-setup engine`.

## Task 7: Export helper (SVG → PNG + print)

**Files:** Create `apps/web/lib/export-diagram.ts`, `apps/web/__tests__/export-diagram.test.ts`

- [ ] **Step 1: Failing test** (serialization is testable in jsdom; canvas raster is browser-only)

```ts
import { describe, it, expect } from 'vitest';
import { serializeSvg } from '@/lib/export-diagram';

describe('serializeSvg', () => {
  it('wraps svg markup with xml namespace', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '10'); svg.setAttribute('height', '10');
    const out = serializeSvg(svg);
    expect(out).toContain('<svg'); expect(out).toContain('xmlns');
  });
});
```

- [ ] **Step 2:** Run `corepack pnpm --filter @valor/web test export-diagram` → FAIL.
- [ ] **Step 3: Implement**

```ts
export function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(clone);
}

export async function exportSvgToPng(svg: SVGSVGElement, filename = 'wellbore.png', scale = 2): Promise<void> {
  const xml = serializeSvg(svg);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
  const w = svg.viewBox.baseVal.width || svg.clientWidth || 800;
  const h = svg.viewBox.baseVal.height || svg.clientHeight || 1000;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale; canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0D1E35'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}

export function printDiagram(): void { window.print(); }
```

- [ ] **Step 4:** Run → PASS.  **Step 5:** Commit `feat(web): SVG→PNG + print export helper`.

## Task 8: `<WellboreSchematic>` component

**Files:** Create `apps/web/components/wellbore-schematic.tsx`, `apps/web/__tests__/wellbore-schematic.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { projectWellbore, DEFAULT_WELL_SETUP } from '@valor/core';
import { WellboreSchematic } from '@/components/wellbore-schematic';

describe('WellboreSchematic', () => {
  it('renders a casing label and a formation name', () => {
    const model = projectWellbore(DEFAULT_WELL_SETUP);
    const { container, getByText } = render(<WellboreSchematic model={model} depthUnit="ft" diaUnit="in" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(getByText(/Production/)).toBeTruthy();
    expect(getByText(/Target Sand/)).toBeTruthy();
  });
});
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — a forward-ref SVG (so the page can grab the node for export). Depth-scaled; casings as nested vertical rects by OD; hole channel; formation markers + labels; left depth axis (converted to `depthUnit`); a title block with the coded header. Use Valor tokens (navy bg `#0D1E35`, gold strokes, cream text). Convert displayed depths via `convertLength(ft, 'ft', depthUnit)` and diameters via `convertLength(in, 'in', diaUnit)`. Signature:

```tsx
'use client';
import { forwardRef } from 'react';
import type { WellboreModel } from '@valor/core';
import { convertLength, type LengthUnit } from '@valor/core';

export interface WellboreSchematicProps { model: WellboreModel; depthUnit: LengthUnit; diaUnit: LengthUnit; }
export const WellboreSchematic = forwardRef<SVGSVGElement, WellboreSchematicProps>(function WellboreSchematic(
  { model, depthUnit, diaUnit }, ref) { /* …compute scale = height/totalDepthFt; map each casing to x by OD rank; draw rects/lines/text… */ }
);
```

Render requirements the test and DoD depend on: an `<svg>` with a `viewBox`; each casing's role as `<text>`; each formation's name as `<text>`; depth labels in the selected unit; graceful render when `totalDepthFt === 0`.

- [ ] **Step 4:** Run → PASS.  **Step 5:** Commit `feat(web): wellbore schematic SVG`.

## Task 9: `<WellSetupPanels>` (registry-driven inputs + Bank picker + unit selectors)

**Files:** Create `apps/web/components/well-setup-panels.tsx`, `apps/web/__tests__/well-setup-panels.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DEFAULT_WELL_SETUP } from '@valor/core';
import { WellSetupPanels } from '@/components/well-setup-panels';

describe('WellSetupPanels', () => {
  it('edits the well name via onChange', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="in" />,
    );
    fireEvent.change(getByLabelText(/Well name/i), { target: { value: 'New Name' } });
    expect(onChange).toHaveBeenCalled();
  });
  it('renders Bank codes in the job-code picker', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="in" />,
    );
    const select = getByLabelText(/Job code/i) as HTMLSelectElement;
    expect(select.querySelectorAll('option').length).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** — controlled (`setup`, `onChange(next: WellSetup)`); render `HEADER_FIELDS` (code→`<select>` over `BANK_SEED`; enum→`<select>`; datetime→`<input type="datetime-local">`; number→numeric input with unit suffix via `diaUnit`/`depthUnit`; text→text input). Below, repeatable tables for casings/holes/formations using `CASING_COLUMNS`/`HOLE_COLUMNS`/`FORMATION_COLUMNS` with Add/Remove row. Number inputs display in the chosen unit and convert back to canonical (in/ft) on change via `convertLength`. Reuse the hydraulics-panel input styling + `Card`. Each control has an associated `<label htmlFor>` matching the test queries.

- [ ] **Step 4:** Run → PASS.  **Step 5:** Commit `feat(web): well-setup input panels + Bank picker + unit flip`.

## Task 10: `/wells/[wellId]/setup` page

**Files:** Create `apps/web/app/wells/[wellId]/setup/page.tsx`

- [ ] **Step 1: Implement** — a `'use client'` page that:
  - resolves `wellId` from params; on mount, `getRepo().loadWellSetup(wellId)` → fall back to `DEFAULT_WELL_SETUP`.
  - holds `setup`, `depthUnit` (`'ft'`), `diaUnit` (`'in'`) in state; derives `model = projectWellbore(setup)`.
  - left: `<WellSetupPanels>`; right (sticky): a `ref`'d `<WellboreSchematic>` + toolbar (depth-unit selector `ft|m|yd`; dia-unit selector `in|mm|cm`; **Save**, **Export PNG**, **Print/PDF**) wired to `getRepo().saveWellSetup`, `exportSvgToPng(ref.current!)`, `printDiagram`.
  - render `model.warnings` like the hydraulics panel.
  - wrap in the existing `PageHeader`/`page-container` brand layout; add a print stylesheet block hiding inputs on `@media print`.

- [ ] **Step 2:** `corepack pnpm --filter @valor/web build` → compiles `/wells/[wellId]/setup`.
- [ ] **Step 3:** Commit `feat(web): well-setup → diagram → export page`.

## Task 11: Integrate, verify, ship to the live link

- [ ] `corepack pnpm --filter @valor/core test` + `--filter @valor/web test` → all green.
- [ ] `corepack pnpm --filter @valor/web build` → clean (tsc 0).
- [ ] Add a link to `/wells/[wellId]/setup` from the well detail page (`apps/web/app/wells/[wellId]/page.tsx`) — a "Well Setup" button.
- [ ] Rebuild, restart prod server on 3210 (keeper tunnel serves it), capture Playwright screenshots of the setup screen (edit → diagram → unit flip → export), send for punchlist.
- [ ] Commit `feat(web): link well detail → setup`.

---

## Review pipeline

After Task 11, run gates 5–8 from `docs/superpowers/process/review-pipeline.md` (comprehensive value×context×intent review → resolve → test-after-resolution → human merge), with the dual-bot PR review when pushed.

## Self-Review (author checklist)

- **Spec coverage:** coded header (§2 ✓ T3), input items (§3 ✓ T3), WellboreModel (§4 ✓ T3/T4), diagram (§5 ✓ T8), export (§6 ✓ T7/T10), persistence (§7 ✓ T5), units (§8 ✓ T1 + T8/T9/T10), files (§9 ✓), testing (§10 ✓ each task), DoD (§11 ✓ T10/T11). Cement detail intentionally deferred (TOC carried on casing rows) — noted as YAGNI for slice 1.
- **Type consistency:** `WellSetup`/`WellboreModel`/`CasingRow`/`LengthUnit`/`projectWellbore`/`saveWellSetup`/`loadWellSetup`/`HEADER_FIELDS`/`*_COLUMNS`/`BANK_SEED` used identically across tasks.
- **No placeholders:** every code step has real code; commands have expected results.
