# Hydraulics & Circulation Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the mining-pilot catalog's first module into a working feature — a pure, TDD'd `computeHydraulics()` in `@valor/core` plus a registry-driven calculator panel that routes input fields → the compute method → live outputs.

**Architecture:** The compute logic is a pure function in `@valor/core/src/compute/hydraulics.ts` (same style as `validation.ts`/`transitions.ts`), unit-tested with Vitest. A field/output registry (mirroring the `field_defs` pattern) drives a client-side panel that recomputes on input change. v1 is a live calculator (no persistence); saving a calc onto a job's `field_values` is a later increment that rides on the Plan 3 job-detail forms. Formulas are the standard industry equations from `docs/superpowers/knowledge/2026-06-07-knowledge-mining-pilot.md` §B1/§B2.

**Tech Stack:** TypeScript, Vitest, Next.js 15 + React 19, Tailwind + shadcn/ui (Valor dark/gold/glass theme already in place).

**Branch:** `feat/hydraulics-module` (from `master`).

---

## File Structure

```
packages/core/
  src/compute/hydraulics.ts   # NEW: inputs/result types, computeHydraulics(), field + output registries
  src/index.ts                # MODIFY: export compute/hydraulics
  test/hydraulics.test.ts     # NEW: formula tests (validated vs the pilot's observed pump output)
apps/web/
  components/hydraulics-panel.tsx        # NEW: client panel (registry-driven inputs -> live outputs)
  app/(hub)/tools/hydraulics/page.tsx    # NEW: route /tools/hydraulics
  components/app-shell.tsx               # MODIFY: add Hydraulics nav item
```

---

## Task 1: Compute core + registries (TDD)

**Files:**
- Create: `packages/core/src/compute/hydraulics.ts`
- Test: `packages/core/test/hydraulics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/hydraulics.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeHydraulics, type HydraulicsInputs } from '../src/compute/hydraulics';

const BASE: HydraulicsInputs = {
  holeDiameterIn: 9.875,
  pipeOdIn: 5.0,
  pipeIdIn: 4.276,
  measuredDepthFt: 4400,
  trueVerticalDepthFt: 4400,
  mudWeightPpg: 12.4,
  pumpLinerIdIn: 6.25,
  pumpStrokeLengthIn: 12,
  pumpEfficiencyPct: 95,
  spm: 60,
};

describe('computeHydraulics', () => {
  it('computes capacities, volumes, pump output, and pressures', () => {
    const r = computeHydraulics(BASE);
    expect(r.annularCapacityBblPerFt).toBeCloseTo(0.0704, 4);
    expect(r.pipeCapacityBblPerFt).toBeCloseTo(0.0178, 4);
    expect(r.annularVolumeBbl).toBeCloseTo(309.96, 1);
    expect(r.pumpOutputBblPerStk).toBeCloseTo(0.1082, 4);
    expect(r.flowRateGpm).toBeCloseTo(272.69, 1);
    expect(r.bottomsUpStrokes).toBeCloseTo(2864.0, 0);
    expect(r.bottomsUpTimeMin).toBeCloseTo(47.73, 1);
    expect(r.annularVelocityFtPerMin).toBeCloseTo(92.13, 1);
    expect(r.hydrostaticPressurePsi).toBeCloseTo(2837.12, 1);
    expect(r.warnings).toEqual([]);
  });

  it('warns and zeroes annular figures when hole does not exceed pipe OD', () => {
    const r = computeHydraulics({ ...BASE, holeDiameterIn: 5.0 });
    expect(r.annularCapacityBblPerFt).toBe(0);
    expect(r.annularVolumeBbl).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/exceed pipe OD/i);
  });

  it('warns when SPM is zero (bottoms-up time undefined)', () => {
    const r = computeHydraulics({ ...BASE, spm: 0 });
    expect(r.flowRateGpm).toBe(0);
    expect(r.bottomsUpTimeMin).toBe(0);
    expect(r.warnings.join(' ')).toMatch(/SPM is zero/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm --filter @valor/core test hydraulics`
Expected: FAIL — cannot resolve `../src/compute/hydraulics`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/compute/hydraulics.ts`:
```ts
export interface HydraulicsInputs {
  holeDiameterIn: number;
  pipeOdIn: number;
  pipeIdIn: number;
  measuredDepthFt: number;
  trueVerticalDepthFt: number;
  mudWeightPpg: number;
  pumpLinerIdIn: number;
  pumpStrokeLengthIn: number;
  pumpEfficiencyPct: number;
  spm: number;
}

export interface HydraulicsResult {
  annularCapacityBblPerFt: number;
  pipeCapacityBblPerFt: number;
  annularVolumeBbl: number;
  pumpOutputBblPerStk: number;
  flowRateGpm: number;
  bottomsUpStrokes: number;
  bottomsUpTimeMin: number;
  annularVelocityFtPerMin: number;
  hydrostaticPressurePsi: number;
  warnings: string[];
}

// bbl/stroke per (in^2 * in), triplex single-acting. (Derived from the standard
// (pi/4 * ID^2 * stroke * 3 cylinders) / (231 in^3/gal * 42 gal/bbl); ~0.0002429.)
const PUMP_TRIPLEX_FACTOR = 0.000243;
// in^2 -> bbl/ft capacity constant: 1 bbl = 9702 in^3; capacity(bbl/ft) = ID^2 / 1029.4.
const CAPACITY_CONSTANT = 1029.4;

export function computeHydraulics(i: HydraulicsInputs): HydraulicsResult {
  const warnings: string[] = [];

  const annClearanceSq = i.holeDiameterIn ** 2 - i.pipeOdIn ** 2;
  let annularCapacityBblPerFt = 0;
  if (annClearanceSq <= 0) {
    warnings.push('Hole diameter must exceed pipe OD for a valid annulus.');
  } else {
    annularCapacityBblPerFt = annClearanceSq / CAPACITY_CONSTANT;
  }

  const pipeCapacityBblPerFt = i.pipeIdIn ** 2 / CAPACITY_CONSTANT;
  const annularVolumeBbl = annularCapacityBblPerFt * i.measuredDepthFt;

  const eff = i.pumpEfficiencyPct / 100;
  const pumpOutputBblPerStk = PUMP_TRIPLEX_FACTOR * i.pumpLinerIdIn ** 2 * i.pumpStrokeLengthIn * eff;
  const flowRateGpm = pumpOutputBblPerStk * 42 * i.spm;

  let bottomsUpStrokes = 0;
  if (pumpOutputBblPerStk > 0) {
    bottomsUpStrokes = annularVolumeBbl / pumpOutputBblPerStk;
  }
  let bottomsUpTimeMin = 0;
  if (i.spm > 0) {
    bottomsUpTimeMin = bottomsUpStrokes / i.spm;
  } else if (bottomsUpStrokes > 0) {
    warnings.push('SPM is zero — bottoms-up time is undefined.');
  }

  let annularVelocityFtPerMin = 0;
  if (annClearanceSq > 0) {
    annularVelocityFtPerMin = (24.5 * flowRateGpm) / annClearanceSq;
  }

  const hydrostaticPressurePsi = 0.052 * i.mudWeightPpg * i.trueVerticalDepthFt;

  return {
    annularCapacityBblPerFt,
    pipeCapacityBblPerFt,
    annularVolumeBbl,
    pumpOutputBblPerStk,
    flowRateGpm,
    bottomsUpStrokes,
    bottomsUpTimeMin,
    annularVelocityFtPerMin,
    hydrostaticPressurePsi,
    warnings,
  };
}

// --- Registry: drives the panel (mirrors the field_defs pattern) ---

export interface CalcFieldSpec {
  key: keyof HydraulicsInputs;
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  group: 'Geometry' | 'Depth' | 'Fluid' | 'Pump';
}

export const HYDRAULICS_FIELDS: CalcFieldSpec[] = [
  { key: 'holeDiameterIn', label: 'Hole diameter', unit: 'in', min: 3, max: 36, default: 9.875, group: 'Geometry' },
  { key: 'pipeOdIn', label: 'Pipe OD', unit: 'in', min: 1, max: 10, default: 5.0, group: 'Geometry' },
  { key: 'pipeIdIn', label: 'Pipe ID', unit: 'in', min: 0.5, max: 9, default: 4.276, group: 'Geometry' },
  { key: 'measuredDepthFt', label: 'Measured depth (MD)', unit: 'ft', min: 0, max: 40000, default: 4400, group: 'Depth' },
  { key: 'trueVerticalDepthFt', label: 'True vertical depth (TVD)', unit: 'ft', min: 0, max: 40000, default: 4400, group: 'Depth' },
  { key: 'mudWeightPpg', label: 'Mud weight', unit: 'ppg', min: 7, max: 20, default: 12.4, group: 'Fluid' },
  { key: 'pumpLinerIdIn', label: 'Pump liner ID', unit: 'in', min: 3, max: 8, default: 6.25, group: 'Pump' },
  { key: 'pumpStrokeLengthIn', label: 'Pump stroke length', unit: 'in', min: 6, max: 18, default: 12, group: 'Pump' },
  { key: 'pumpEfficiencyPct', label: 'Pump efficiency', unit: '%', min: 50, max: 100, default: 95, group: 'Pump' },
  { key: 'spm', label: 'Pump speed', unit: 'spm', min: 0, max: 200, default: 60, group: 'Pump' },
];

export interface CalcOutputSpec {
  key: keyof Omit<HydraulicsResult, 'warnings'>;
  label: string;
  unit: string;
  decimals: number;
}

export const HYDRAULICS_OUTPUTS: CalcOutputSpec[] = [
  { key: 'annularCapacityBblPerFt', label: 'Annular capacity', unit: 'bbl/ft', decimals: 4 },
  { key: 'pipeCapacityBblPerFt', label: 'Pipe capacity', unit: 'bbl/ft', decimals: 4 },
  { key: 'annularVolumeBbl', label: 'Annular volume', unit: 'bbl', decimals: 1 },
  { key: 'pumpOutputBblPerStk', label: 'Pump output', unit: 'bbl/stk', decimals: 4 },
  { key: 'flowRateGpm', label: 'Flow rate', unit: 'gpm', decimals: 1 },
  { key: 'bottomsUpStrokes', label: 'Bottoms-up', unit: 'strokes', decimals: 0 },
  { key: 'bottomsUpTimeMin', label: 'Bottoms-up time', unit: 'min', decimals: 1 },
  { key: 'annularVelocityFtPerMin', label: 'Annular velocity', unit: 'ft/min', decimals: 1 },
  { key: 'hydrostaticPressurePsi', label: 'Hydrostatic pressure', unit: 'psi', decimals: 0 },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `corepack pnpm --filter @valor/core test hydraulics`
Expected: PASS — 3 passed. (The `pumpOutputBblPerStk` ≈ 0.1082 anchor matches the value observed in the source sheet, validating the generic formula without copying it.)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/compute/hydraulics.ts packages/core/test/hydraulics.test.ts
git commit -m "feat(core): hydraulics & circulation compute + field/output registries"
```

---

## Task 2: Export from the core barrel

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add the export**

Append to `packages/core/src/index.ts`:
```ts
export * from './compute/hydraulics';
```

- [ ] **Step 2: Verify full suite + typecheck**

Run:
```bash
corepack pnpm --filter @valor/core test
corepack pnpm --filter @valor/core exec tsc --noEmit
```
Expected: all suites pass (**33 tests**: prior 30 + 3 hydraulics); tsc exit 0.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export hydraulics module from barrel"
```

---

## Task 3: Calculator panel, route, and nav

**Files:**
- Create: `apps/web/components/hydraulics-panel.tsx`
- Create: `apps/web/app/(hub)/tools/hydraulics/page.tsx`
- Modify: `apps/web/components/app-shell.tsx`

- [ ] **Step 1: Create the panel (client component, registry-driven, live recompute)**

Create `apps/web/components/hydraulics-panel.tsx`:
```tsx
'use client';

import { useState } from 'react';
import {
  computeHydraulics,
  HYDRAULICS_FIELDS,
  HYDRAULICS_OUTPUTS,
  type HydraulicsInputs,
} from '@valor/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DEFAULTS = Object.fromEntries(
  HYDRAULICS_FIELDS.map((f) => [f.key, f.default]),
) as unknown as HydraulicsInputs;

const GROUPS = ['Geometry', 'Depth', 'Fluid', 'Pump'] as const;

export function HydraulicsPanel() {
  const [inputs, setInputs] = useState<HydraulicsInputs>(DEFAULTS);
  const result = computeHydraulics(inputs);

  const setField = (key: keyof HydraulicsInputs, raw: string) =>
    setInputs((prev) => ({ ...prev, [key]: raw === '' ? 0 : Number(raw) }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="eyebrow mb-2">{group}</div>
              <div className="grid grid-cols-2 gap-3">
                {HYDRAULICS_FIELDS.filter((f) => f.group === group).map((f) => (
                  <label key={f.key} className="text-sm">
                    <span className="block text-muted-foreground">
                      {f.label} <span className="font-mono text-xs text-muted-foreground/70">({f.unit})</span>
                    </span>
                    <input
                      type="number"
                      value={Number.isFinite(inputs[f.key]) ? inputs[f.key] : ''}
                      min={f.min}
                      max={f.max}
                      step="any"
                      onChange={(e) => setField(f.key, e.target.value)}
                      className="mt-1 w-full rounded-md border border-border bg-background/40 px-2 py-1 font-mono text-sm text-cream outline-none focus:border-gold/50"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2">
            {HYDRAULICS_OUTPUTS.map((o) => (
              <div key={o.key} className="flex items-baseline justify-between border-b border-border/40 pb-1.5">
                <dt className="text-sm text-muted-foreground">{o.label}</dt>
                <dd className="font-mono text-sm">
                  <span className="text-gold">{result[o.key].toFixed(o.decimals)}</span>{' '}
                  <span className="text-xs text-muted-foreground/70">{o.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
          {result.warnings.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-red-400">
              {result.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create the route**

Create `apps/web/app/(hub)/tools/hydraulics/page.tsx`:
```tsx
import { HydraulicsPanel } from '@/components/hydraulics-panel';

export default function HydraulicsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="eyebrow">Calculator</div>
        <h1 className="font-display text-2xl text-cream">Hydraulics &amp; Circulation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Annular volumes, pump output, bottoms-up, and pressures from rig &amp; fluid inputs.
        </p>
      </div>
      <HydraulicsPanel />
    </div>
  );
}
```

- [ ] **Step 3: Add the nav item**

In `apps/web/components/app-shell.tsx`:

Change the icon import (line 6) from:
```tsx
import { Activity, Layers } from 'lucide-react';
```
to:
```tsx
import { Activity, Layers, Gauge } from 'lucide-react';
```

And change the `NAV` array (lines 10-13) from:
```tsx
const NAV = [
  { href: '/jobs', label: 'Active Jobs', icon: Activity },
  { href: '/assets', label: 'Assets', icon: Layers },
];
```
to:
```tsx
const NAV = [
  { href: '/jobs', label: 'Active Jobs', icon: Activity },
  { href: '/assets', label: 'Assets', icon: Layers },
  { href: '/tools/hydraulics', label: 'Hydraulics', icon: Gauge },
];
```

- [ ] **Step 4: Verify build, typecheck, and runtime render**

Run:
```bash
corepack pnpm --filter @valor/web exec tsc --noEmit
corepack pnpm --filter @valor/web build
(corepack pnpm --filter @valor/web start -- -p 3100 &) ; sleep 6
curl -s http://localhost:3100/tools/hydraulics | grep -o "Hydraulics &amp; Circulation"
curl -s http://localhost:3100/tools/hydraulics | grep -o "Annular capacity"
# kill the server on port 3100
```
Expected: tsc clean; build compiles `/tools/hydraulics`; curl finds the heading and an output label. (The panel computes client-side, so values render on interaction in a browser; the server-rendered HTML includes the labels.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/hydraulics-panel.tsx "apps/web/app/(hub)/tools/hydraulics/page.tsx" apps/web/components/app-shell.tsx
git commit -m "feat(web): hydraulics & circulation calculator panel"
```

---

## Task 4: Finish — review pipeline & merge

Follow `docs/superpowers/process/review-pipeline.md`.

- [ ] **Step 1: Final verification**
```bash
corepack pnpm --filter @valor/core test           # 33 passing
corepack pnpm --filter @valor/web build           # succeeds
```

- [ ] **Step 2: Push + PR**
```bash
git push -u origin feat/hydraulics-module
gh pr create --base master --head feat/hydraulics-module \
  --title "Hydraulics & Circulation module (first mined module)" \
  --body "Pure computeHydraulics() in @valor/core (TDD, 3 tests) + registry-driven calculator panel at /tools/hydraulics. First working module derived from the knowledge-mining catalog. Standard industry formulas (pump output anchor matches the source sheet's observed value, validating the generic math without copying it).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Triage CodeRabbit** per the merge checklist; fix/justify findings.

- [ ] **Step 4: Human review + merge.**

---

## Definition of Done

- `corepack pnpm --filter @valor/core test` → 33 passing (incl. 3 hydraulics).
- `corepack pnpm --filter @valor/web build` → `/tools/hydraulics` compiles.
- The calculator renders in the Valor theme, recomputes live, shows the 9 outputs + warnings, and is reachable from the sidebar nav.
- Compute lives in `@valor/core` (shared, testable); the panel only consumes it — same adapter-agnostic seam.

## Next increment
Persist a hydraulics calc onto a job (write inputs + outputs as `field_values`) — rides on the Plan 3 job-detail forms + the eventual Supabase adapter.
