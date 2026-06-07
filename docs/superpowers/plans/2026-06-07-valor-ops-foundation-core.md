# Valor Operations Hub — Plan 1: Foundation & Domain Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm monorepo, a fully-tested `@valor/core` domain layer (types, Zod schemas, status/stage transition rules, template→stage instantiation, field validation, repository interface, and a seeded in-memory mock adapter), and a minimal runnable Next.js web app that renders the Active Jobs board from the mock adapter.

**Architecture:** Frontend-first with a swappable data layer. The UI depends only on a `Repository` interface in `@valor/core`; Plan 1 ships an in-memory `MockRepository` seeded with the real VEP "Lease Free #1" well. The Supabase adapter (Plan 4) drops in behind the same interface without UI changes. Pure domain logic lives in `@valor/core` and is unit-tested with Vitest.

**Tech Stack:** pnpm workspaces, TypeScript 5.7, Vitest 2, Next.js 15 (App Router) + React 19, Tailwind CSS 3.4.

**Spec:** `docs/superpowers/specs/2026-06-07-valor-operations-hub-design.md`

---

## File Structure

```
ValorOperations_SB/
  package.json                       # root workspace + scripts
  pnpm-workspace.yaml
  tsconfig.base.json
  packages/core/
    package.json
    tsconfig.json
    vitest.config.ts
    src/
      enums.ts                       # role/status/type unions + JOB_STATUS_TRANSITIONS
      types.ts                       # domain entity interfaces
      transitions.ts                 # canTransitionJobStatus / assertJobStatusTransition
      templates.ts                   # instantiateStages
      validation.ts                  # validateFieldValue
      repository.ts                  # Repository interface + input types
      seed.ts                        # createSeed() — VEP Lease Free #1 data
      mock-repository.ts             # MockRepository implements Repository
      index.ts                       # barrel export
    test/
      transitions.test.ts
      templates.test.ts
      validation.test.ts
      mock-repository.test.ts
  apps/web/
    package.json
    next.config.mjs
    next-env.d.ts
    tsconfig.json
    tailwind.config.ts
    postcss.config.mjs
    lib/repo.ts                      # MockRepository singleton + DEMO_ORG_ID
    components/
      app-shell.tsx
      kpi-strip.tsx
      jobs-board.tsx
    app/
      globals.css
      layout.tsx
      page.tsx                       # redirect → /jobs
      (hub)/
        layout.tsx                   # renders AppShell
        jobs/page.tsx                # Active Jobs board
```

**Responsibilities:** each `@valor/core` file is one concern (enums, types, one logic function group, the interface, the seed, the adapter). Web components are presentational; the only data entry point is `lib/repo.ts`.

---

## Task 1: Initialize pnpm monorepo workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`

- [ ] **Step 1: Activate pnpm via corepack**

Run:
```bash
corepack prepare pnpm@9.15.0 --activate
pnpm --version
```
Expected: prints `9.15.0`.

- [ ] **Step 2: Create the root workspace manifest**

Create `package.json`:
```json
{
  "name": "valor-operations",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm --filter @valor/web dev",
    "build": "pnpm --filter @valor/web build",
    "test": "pnpm --filter @valor/core test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 3: Create the workspace package globs**

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 4: Create the shared TS base config**

Create `tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

- [ ] **Step 5: Install (creates lockfile) and verify**

Run:
```bash
pnpm install
```
Expected: completes, writes `pnpm-lock.yaml`, no packages yet beyond root devDeps.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml
git commit -m "chore: initialize pnpm monorepo workspace"
```

---

## Task 2: Scaffold the `@valor/core` package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Test: `packages/core/test/smoke.test.ts`

- [ ] **Step 1: Create the package manifest**

Create `packages/core/package.json`:
```json
{
  "name": "@valor/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create the package tsconfig**

Create `packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create the vitest config**

Create `packages/core/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Write a smoke test**

Create `packages/core/test/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Install workspace deps and run the smoke test**

Run:
```bash
pnpm install
pnpm --filter @valor/core test
```
Expected: vitest runs, `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/package.json packages/core/tsconfig.json packages/core/vitest.config.ts packages/core/test/smoke.test.ts pnpm-lock.yaml
git commit -m "chore: scaffold @valor/core package with vitest"
```

---

## Task 3: Domain enums and entity types

**Files:**
- Create: `packages/core/src/enums.ts`
- Create: `packages/core/src/types.ts`

These are type/constant definitions consumed by every later task. Verification is a typecheck (no runtime behavior yet).

- [ ] **Step 1: Create the enums + transition table**

Create `packages/core/src/enums.ts`:
```ts
export type Role = 'owner' | 'admin' | 'ops' | 'field' | 'vendor' | 'viewer';
export type JobType = 'drilling' | 'completion' | 'workover' | 'other';
export type JobStatus =
  | 'planned'
  | 'mobilized'
  | 'executing'
  | 'suspended'
  | 'complete'
  | 'closed';
export type StageStatus = 'planned' | 'active' | 'done' | 'skipped';
export type FieldDataType = 'number' | 'text' | 'bool' | 'date' | 'enum';
export type FieldScope = 'job' | 'stage';
export type EventType = 'activity' | 'npt' | 'milestone' | 'hse' | 'note';
export type WellboreType = 'vertical' | 'directional' | 'horizontal';
export type CasingStringType = 'conductor' | 'surface' | 'intermediate' | 'production';

/** Allowed lifecycle-phase transitions for a job. */
export const JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  planned: ['mobilized', 'closed'],
  mobilized: ['executing', 'suspended', 'planned'],
  executing: ['suspended', 'complete'],
  suspended: ['executing', 'closed'],
  complete: ['closed'],
  closed: [],
};
```

- [ ] **Step 2: Create the entity interfaces**

Create `packages/core/src/types.ts`:
```ts
import type {
  CasingStringType,
  EventType,
  FieldDataType,
  FieldScope,
  JobStatus,
  JobType,
  StageStatus,
  WellboreType,
} from './enums';

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Asset {
  id: string;
  orgId: string;
  name: string;
  region?: string;
}

export interface Pad {
  id: string;
  orgId: string;
  assetId: string;
  name: string;
  surfaceLat?: number;
  surfaceLong?: number;
}

export interface Well {
  id: string;
  orgId: string;
  padId: string;
  name: string;
  apiNumber?: string;
  permitNumber?: string;
  state?: string;
  county?: string;
  township?: string;
  section?: string;
  surfaceLat?: number;
  surfaceLong?: number;
  groundElevFt?: number;
  kbHeightFt?: number;
  status?: string;
  spudDate?: string;
}

export interface Wellbore {
  id: string;
  orgId: string;
  wellId: string;
  designation: string;
  totalMdFt?: number;
  totalTvdFt?: number;
  type: WellboreType;
}

export interface Formation {
  id: string;
  orgId: string;
  wellboreId: string;
  name: string;
  topMdFt?: number;
  bottomMdFt?: number;
  lithology?: string;
  targetZone: boolean;
  sortOrder: number;
}

export interface CasingString {
  id: string;
  orgId: string;
  wellboreId: string;
  stringType: CasingStringType;
  holeDiaIn?: number;
  setMdFt?: number;
  setTvdFt?: number;
  csgOdIn?: number;
  csgIdIn?: number;
  weightPpf?: number;
  grade?: string;
  connection?: string;
  tocFt?: number;
  cementWeightPpg?: number;
  cementSacks?: number;
  cementExcessPct?: number;
  sortOrder: number;
}

export interface JobTemplate {
  id: string;
  orgId: string;
  name: string;
  jobType: JobType;
  version: number;
  isActive: boolean;
}

export interface TemplateStageDef {
  id: string;
  templateId: string;
  name: string;
  stageType: string;
  defaultSortOrder: number;
}

export interface TemplateFieldDef {
  id: string;
  templateId: string;
  scope: FieldScope;
  key: string;
  label: string;
  dataType: FieldDataType;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  enumOptions?: string[];
  required: boolean;
  sortOrder: number;
}

export interface Job {
  id: string;
  orgId: string;
  wellId: string;
  wellboreId?: string;
  templateId: string;
  name: string;
  jobType: JobType;
  status: JobStatus;
  afeNumber?: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  rigId?: string;
  primaryVendorId?: string;
  createdBy: string;
}

export interface JobStatusHistory {
  id: string;
  jobId: string;
  fromStatus: JobStatus | null;
  toStatus: JobStatus;
  changedBy: string;
  changedAt: string;
  note?: string;
}

export interface Stage {
  id: string;
  orgId: string;
  jobId: string;
  stageNo: number;
  name: string;
  stageType: string;
  status: StageStatus;
  plannedStart?: string;
  actualStart?: string;
  actualEnd?: string;
  depthInFt?: number;
  depthOutFt?: number;
  notes?: string;
  sortOrder: number;
}

export interface JobWithRelations extends Job {
  well: Well;
  stages: Stage[];
  statusHistory: JobStatusHistory[];
}

export interface EventRecord {
  id: string;
  orgId: string;
  jobId: string;
  stageId?: string;
  eventType: EventType;
  categoryCode?: string;
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  nptHours?: number;
  createdBy: string;
}
```

- [ ] **Step 3: Verify it typechecks**

Run:
```bash
pnpm --filter @valor/core exec tsc --noEmit
```
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/enums.ts packages/core/src/types.ts
git commit -m "feat(core): domain enums, transition table, and entity types"
```

---

## Task 4: Job status transition rules (TDD)

**Files:**
- Create: `packages/core/src/transitions.ts`
- Test: `packages/core/test/transitions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/transitions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  canTransitionJobStatus,
  assertJobStatusTransition,
  TransitionError,
} from '../src/transitions';

describe('job status transitions', () => {
  it('allows planned -> mobilized', () => {
    expect(canTransitionJobStatus('planned', 'mobilized')).toBe(true);
  });

  it('rejects planned -> executing (must mobilize first)', () => {
    expect(canTransitionJobStatus('planned', 'executing')).toBe(false);
  });

  it('allows executing -> complete', () => {
    expect(canTransitionJobStatus('executing', 'complete')).toBe(true);
  });

  it('treats closed as terminal', () => {
    expect(canTransitionJobStatus('closed', 'planned')).toBe(false);
  });

  it('assert throws TransitionError on illegal transition', () => {
    expect(() => assertJobStatusTransition('planned', 'executing')).toThrow(TransitionError);
  });

  it('assert is silent on legal transition', () => {
    expect(() => assertJobStatusTransition('planned', 'mobilized')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm --filter @valor/core test transitions
```
Expected: FAIL — cannot resolve `../src/transitions.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/transitions.ts`:
```ts
import { JOB_STATUS_TRANSITIONS } from './enums';
import type { JobStatus } from './enums';

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransitionError';
  }
}

export function canTransitionJobStatus(from: JobStatus, to: JobStatus): boolean {
  return JOB_STATUS_TRANSITIONS[from].includes(to);
}

export function assertJobStatusTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransitionJobStatus(from, to)) {
    throw new TransitionError(`Illegal job status transition: ${from} -> ${to}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
pnpm --filter @valor/core test transitions
```
Expected: PASS — 6 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/transitions.ts packages/core/test/transitions.test.ts
git commit -m "feat(core): job status transition rules"
```

---

## Task 5: Template → stage instantiation (TDD)

**Files:**
- Create: `packages/core/src/templates.ts`
- Test: `packages/core/test/templates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/templates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { instantiateStages } from '../src/templates';
import type { TemplateStageDef } from '../src/types';

const defs: TemplateStageDef[] = [
  { id: 'sd-3', templateId: 't1', name: 'Production', stageType: 'drill_case', defaultSortOrder: 30 },
  { id: 'sd-1', templateId: 't1', name: 'Conductor', stageType: 'drill_case', defaultSortOrder: 10 },
  { id: 'sd-2', templateId: 't1', name: 'Surface', stageType: 'drill_case', defaultSortOrder: 20 },
];

describe('instantiateStages', () => {
  it('orders by defaultSortOrder and numbers stages from 1', () => {
    const stages = instantiateStages(defs);
    expect(stages.map((s) => s.name)).toEqual(['Conductor', 'Surface', 'Production']);
    expect(stages.map((s) => s.stageNo)).toEqual([1, 2, 3]);
  });

  it('starts every stage in planned status', () => {
    const stages = instantiateStages(defs);
    expect(stages.every((s) => s.status === 'planned')).toBe(true);
  });

  it('returns an empty array for no defs', () => {
    expect(instantiateStages([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm --filter @valor/core test templates
```
Expected: FAIL — cannot resolve `../src/templates.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/templates.ts`:
```ts
import type { StageStatus } from './enums';
import type { TemplateStageDef } from './types';

export interface NewStage {
  stageNo: number;
  name: string;
  stageType: string;
  status: StageStatus;
  sortOrder: number;
}

export function instantiateStages(defs: TemplateStageDef[]): NewStage[] {
  return [...defs]
    .sort((a, b) => a.defaultSortOrder - b.defaultSortOrder)
    .map((d, i) => ({
      stageNo: i + 1,
      name: d.name,
      stageType: d.stageType,
      status: 'planned',
      sortOrder: d.defaultSortOrder,
    }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
pnpm --filter @valor/core test templates
```
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/templates.ts packages/core/test/templates.test.ts
git commit -m "feat(core): instantiate stages from a template"
```

---

## Task 6: Field-value validation (TDD)

**Files:**
- Create: `packages/core/src/validation.ts`
- Test: `packages/core/test/validation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/validation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateFieldValue } from '../src/validation';
import type { TemplateFieldDef } from '../src/types';

function def(partial: Partial<TemplateFieldDef>): TemplateFieldDef {
  return {
    id: 'fd',
    templateId: 't1',
    scope: 'job',
    key: 'k',
    label: 'Field',
    dataType: 'text',
    required: false,
    sortOrder: 0,
    ...partial,
  };
}

describe('validateFieldValue', () => {
  it('coerces a numeric string to a number', () => {
    const r = validateFieldValue(def({ dataType: 'number', label: 'Target WOB' }), '25');
    expect(r.ok).toBe(true);
    expect(r.coerced).toBe(25);
  });

  it('rejects a non-numeric value for a number field', () => {
    const r = validateFieldValue(def({ dataType: 'number' }), 'abc');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/must be a number/);
  });

  it('warns (but accepts) when above max', () => {
    const r = validateFieldValue(
      def({ dataType: 'number', label: 'Target WOB', unit: 'klbf', maxValue: 60 }),
      75,
    );
    expect(r.ok).toBe(true);
    expect(r.coerced).toBe(75);
    expect(r.warning).toMatch(/above max 60/);
  });

  it('errors when a required field is empty', () => {
    const r = validateFieldValue(def({ required: true, label: 'AFE' }), '');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/required/);
  });

  it('accepts an empty optional field', () => {
    const r = validateFieldValue(def({ required: false }), '');
    expect(r.ok).toBe(true);
    expect(r.coerced).toBeUndefined();
  });

  it('parses booleans from common strings', () => {
    expect(validateFieldValue(def({ dataType: 'bool' }), 'yes').coerced).toBe(true);
    expect(validateFieldValue(def({ dataType: 'bool' }), '0').coerced).toBe(false);
  });

  it('rejects an enum value outside its options', () => {
    const r = validateFieldValue(def({ dataType: 'enum', enumOptions: ['J-55', 'L-80'] }), 'P-110');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/one of/);
  });

  it('rejects an invalid date', () => {
    const r = validateFieldValue(def({ dataType: 'date' }), 'not-a-date');
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
pnpm --filter @valor/core test validation
```
Expected: FAIL — cannot resolve `../src/validation.js`.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/validation.ts`:
```ts
import type { TemplateFieldDef } from './types';

export interface FieldValidationResult {
  ok: boolean;
  coerced?: number | string | boolean;
  warning?: string;
  error?: string;
}

function isEmpty(raw: unknown): boolean {
  return raw === null || raw === undefined || raw === '';
}

export function validateFieldValue(def: TemplateFieldDef, raw: unknown): FieldValidationResult {
  if (isEmpty(raw)) {
    return def.required
      ? { ok: false, error: `${def.label} is required` }
      : { ok: true, coerced: undefined };
  }

  switch (def.dataType) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (Number.isNaN(n)) return { ok: false, error: `${def.label} must be a number` };
      const unit = def.unit ? ` ${def.unit}` : '';
      let warning: string | undefined;
      if (def.minValue != null && n < def.minValue) {
        warning = `${def.label} ${n}${unit} is below min ${def.minValue}`;
      }
      if (def.maxValue != null && n > def.maxValue) {
        warning = `${def.label} ${n}${unit} is above max ${def.maxValue}`;
      }
      return { ok: true, coerced: n, warning };
    }
    case 'bool': {
      if (typeof raw === 'boolean') return { ok: true, coerced: raw };
      const s = String(raw).trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(s)) return { ok: true, coerced: true };
      if (['false', '0', 'no', 'n'].includes(s)) return { ok: true, coerced: false };
      return { ok: false, error: `${def.label} must be true/false` };
    }
    case 'date': {
      const s = String(raw);
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return { ok: false, error: `${def.label} must be a valid date` };
      return { ok: true, coerced: s };
    }
    case 'enum': {
      const s = String(raw);
      if (def.enumOptions && !def.enumOptions.includes(s)) {
        return { ok: false, error: `${def.label} must be one of: ${def.enumOptions.join(', ')}` };
      }
      return { ok: true, coerced: s };
    }
    case 'text':
    default:
      return { ok: true, coerced: String(raw) };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
pnpm --filter @valor/core test validation
```
Expected: PASS — 8 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/validation.ts packages/core/test/validation.test.ts
git commit -m "feat(core): field-value validation against template field defs"
```

---

## Task 7: Repository interface + seed data + MockRepository (TDD)

**Files:**
- Create: `packages/core/src/repository.ts`
- Create: `packages/core/src/seed.ts`
- Create: `packages/core/src/mock-repository.ts`
- Test: `packages/core/test/mock-repository.test.ts`

- [ ] **Step 1: Define the repository interface**

Create `packages/core/src/repository.ts`:
```ts
import type { JobStatus } from './enums';
import type { Job, JobTemplate, JobWithRelations, TemplateFieldDef, TemplateStageDef, Well } from './types';

export interface TemplateBundle {
  template: JobTemplate;
  stageDefs: TemplateStageDef[];
  fieldDefs: TemplateFieldDef[];
}

export interface CreateJobFromTemplateInput {
  orgId: string;
  wellId: string;
  wellboreId?: string;
  templateId: string;
  name: string;
  afeNumber?: string;
  rigId?: string;
  primaryVendorId?: string;
  createdBy: string;
}

export interface Repository {
  listWells(orgId: string): Promise<Well[]>;
  getWell(id: string): Promise<Well | null>;
  listTemplates(orgId: string): Promise<JobTemplate[]>;
  getTemplate(id: string): Promise<TemplateBundle | null>;
  listJobs(orgId: string): Promise<Job[]>;
  getJob(id: string): Promise<JobWithRelations | null>;
  createJobFromTemplate(input: CreateJobFromTemplateInput): Promise<Job>;
  advanceJobStatus(jobId: string, to: JobStatus, userId: string, note?: string): Promise<Job>;
}
```

- [ ] **Step 2: Create the seed data**

Create `packages/core/src/seed.ts`:
```ts
import type {
  Asset,
  CasingString,
  Formation,
  Job,
  JobTemplate,
  Pad,
  Stage,
  TemplateFieldDef,
  TemplateStageDef,
  Well,
  Wellbore,
} from './types';

export const DEMO_ORG_ID = 'org-valor';
export const DEMO_USER_ID = 'user-demo';

export interface SeedData {
  assets: Asset[];
  pads: Pad[];
  wells: Well[];
  wellbores: Wellbore[];
  formations: Formation[];
  casingStrings: CasingString[];
  templates: JobTemplate[];
  templateStageDefs: TemplateStageDef[];
  templateFieldDefs: TemplateFieldDef[];
  jobs: Job[];
  stages: Stage[];
}

/** Fresh, deep-cloned seed so each MockRepository instance is isolated. */
export function createSeed(): SeedData {
  const org = DEMO_ORG_ID;

  const assets: Asset[] = [
    { id: 'asset-ross', orgId: org, name: 'Ross County Field', region: 'Appalachia / Ohio' },
  ];

  const pads: Pad[] = [
    { id: 'pad-1', orgId: org, assetId: 'asset-ross', name: 'Lease Free Pad', surfaceLat: 39.3664747, surfaceLong: -83.2625135 },
  ];

  const wells: Well[] = [
    {
      id: 'well-lf1', orgId: org, padId: 'pad-1', name: 'Lease Free #1',
      apiNumber: '34-141-2-0059-00-00', permitNumber: 'PR2026032400122',
      state: 'Ohio', county: 'Ross', township: 'Buckskin', section: 'VMS 2309',
      surfaceLat: 39.3664747, surfaceLong: -83.2625135,
      groundElevFt: 906, kbHeightFt: 8, status: 'permitted',
    },
  ];

  const wellbores: Wellbore[] = [
    { id: 'wb-lf1', orgId: org, wellId: 'well-lf1', designation: 'Original Hole', totalMdFt: 2000, totalTvdFt: 2000, type: 'vertical' },
  ];

  const formations: Formation[] = [
    { id: 'fm-1', orgId: org, wellboreId: 'wb-lf1', name: 'Ohio Shale', topMdFt: 130, bottomMdFt: 268, targetZone: false, sortOrder: 1 },
    { id: 'fm-2', orgId: org, wellboreId: 'wb-lf1', name: 'Packer Shell', topMdFt: 268, bottomMdFt: 716, targetZone: false, sortOrder: 2 },
    { id: 'fm-3', orgId: org, wellboreId: 'wb-lf1', name: 'Trenton Limestone', topMdFt: 1944, bottomMdFt: 2114, targetZone: true, sortOrder: 3 },
    { id: 'fm-4', orgId: org, wellboreId: 'wb-lf1', name: 'Black River Group', topMdFt: 2114, bottomMdFt: 2458, targetZone: false, sortOrder: 4 },
  ];

  const casingStrings: CasingString[] = [
    { id: 'csg-1', orgId: org, wellboreId: 'wb-lf1', stringType: 'conductor', holeDiaIn: 17.5, setMdFt: 114, csgOdIn: 13.375, csgIdIn: 12.615, weightPpf: 54, grade: 'J-55', connection: '8rd', tocFt: 0, cementWeightPpg: 15.7, cementSacks: 125, sortOrder: 1 },
    { id: 'csg-2', orgId: org, wellboreId: 'wb-lf1', stringType: 'surface', holeDiaIn: 12.25, setMdFt: 359, csgOdIn: 7, csgIdIn: 6.366, weightPpf: 23, grade: 'J-55', connection: '8rd', tocFt: 0, cementWeightPpg: 15.7, cementSacks: 266, sortOrder: 2 },
    { id: 'csg-3', orgId: org, wellboreId: 'wb-lf1', stringType: 'production', holeDiaIn: 6, setMdFt: 2000, csgOdIn: 4.5, csgIdIn: 3.875, weightPpf: 11.6, grade: 'L-80', connection: '8rd', tocFt: 0, cementWeightPpg: 12, cementSacks: 765, sortOrder: 3 },
  ];

  const templates: JobTemplate[] = [
    { id: 'tmpl-drill-vert', orgId: org, name: 'Vertical Well — Drill & Case', jobType: 'drilling', version: 1, isActive: true },
  ];

  const templateStageDefs: TemplateStageDef[] = [
    { id: 'tsd-1', templateId: 'tmpl-drill-vert', name: 'Conductor', stageType: 'drill_case', defaultSortOrder: 10 },
    { id: 'tsd-2', templateId: 'tmpl-drill-vert', name: 'Surface', stageType: 'drill_case', defaultSortOrder: 20 },
    { id: 'tsd-3', templateId: 'tmpl-drill-vert', name: 'Production', stageType: 'drill_case', defaultSortOrder: 30 },
  ];

  const templateFieldDefs: TemplateFieldDef[] = [
    { id: 'tfd-1', templateId: 'tmpl-drill-vert', scope: 'job', key: 'target_wob', label: 'Target WOB', dataType: 'number', unit: 'klbf', minValue: 0, maxValue: 60, required: false, sortOrder: 1 },
    { id: 'tfd-2', templateId: 'tmpl-drill-vert', scope: 'job', key: 'target_rop', label: 'Target ROP', dataType: 'number', unit: 'ft/hr', minValue: 0, maxValue: 300, required: false, sortOrder: 2 },
    { id: 'tfd-3', templateId: 'tmpl-drill-vert', scope: 'job', key: 'spud_mud_weight', label: 'Spud Mud Weight', dataType: 'number', unit: 'ppg', minValue: 8, maxValue: 18, required: false, sortOrder: 3 },
    { id: 'tfd-4', templateId: 'tmpl-drill-vert', scope: 'stage', key: 'depth_in', label: 'Depth In', dataType: 'number', unit: 'ft', required: false, sortOrder: 1 },
    { id: 'tfd-5', templateId: 'tmpl-drill-vert', scope: 'stage', key: 'depth_out', label: 'Depth Out', dataType: 'number', unit: 'ft', required: false, sortOrder: 2 },
  ];

  const jobs: Job[] = [
    { id: 'job-1', orgId: org, wellId: 'well-lf1', wellboreId: 'wb-lf1', templateId: 'tmpl-drill-vert', name: 'Conductor & Surface Drilling', jobType: 'drilling', status: 'executing', afeNumber: 'AFE-2026-014', createdBy: DEMO_USER_ID },
    { id: 'job-2', orgId: org, wellId: 'well-lf1', wellboreId: 'wb-lf1', templateId: 'tmpl-drill-vert', name: 'Production Hole — Air Drill', jobType: 'drilling', status: 'planned', afeNumber: 'AFE-2026-021', createdBy: DEMO_USER_ID },
    { id: 'job-3', orgId: org, wellId: 'well-lf1', wellboreId: 'wb-lf1', templateId: 'tmpl-drill-vert', name: 'Rig Up & Mobilization', jobType: 'drilling', status: 'mobilized', afeNumber: 'AFE-2026-009', createdBy: DEMO_USER_ID },
  ];

  const stages: Stage[] = [];

  return {
    assets, pads, wells, wellbores, formations, casingStrings,
    templates, templateStageDefs, templateFieldDefs, jobs, stages,
  };
}
```

- [ ] **Step 3: Write the failing test**

Create `packages/core/test/mock-repository.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEMO_ORG_ID, DEMO_USER_ID } from '../src/seed';
import { TransitionError } from '../src/transitions';

function repo() {
  return new MockRepository();
}

describe('MockRepository', () => {
  it('lists the seeded jobs for the demo org', async () => {
    const jobs = await repo().listJobs(DEMO_ORG_ID);
    expect(jobs).toHaveLength(3);
  });

  it('returns the seeded Lease Free #1 well with its API number', async () => {
    const well = await repo().getWell('well-lf1');
    expect(well?.name).toBe('Lease Free #1');
    expect(well?.apiNumber).toBe('34-141-2-0059-00-00');
  });

  it('creates a job from a template in planned status with numbered stages', async () => {
    const r = repo();
    const job = await r.createJobFromTemplate({
      orgId: DEMO_ORG_ID,
      wellId: 'well-lf1',
      wellboreId: 'wb-lf1',
      templateId: 'tmpl-drill-vert',
      name: 'New Drill Job',
      createdBy: DEMO_USER_ID,
    });
    expect(job.status).toBe('planned');

    const full = await r.getJob(job.id);
    expect(full?.stages.map((s) => s.stageNo)).toEqual([1, 2, 3]);
    expect(full?.stages.map((s) => s.name)).toEqual(['Conductor', 'Surface', 'Production']);
  });

  it('advances a legal status transition and records history', async () => {
    const r = repo();
    const job = await r.createJobFromTemplate({
      orgId: DEMO_ORG_ID, wellId: 'well-lf1', templateId: 'tmpl-drill-vert',
      name: 'X', createdBy: DEMO_USER_ID,
    });
    const updated = await r.advanceJobStatus(job.id, 'mobilized', DEMO_USER_ID);
    expect(updated.status).toBe('mobilized');

    const full = await r.getJob(job.id);
    expect(full?.statusHistory.at(-1)).toMatchObject({ fromStatus: 'planned', toStatus: 'mobilized' });
  });

  it('rejects an illegal status transition', async () => {
    const r = repo();
    const job = await r.createJobFromTemplate({
      orgId: DEMO_ORG_ID, wellId: 'well-lf1', templateId: 'tmpl-drill-vert',
      name: 'Y', createdBy: DEMO_USER_ID,
    });
    await expect(r.advanceJobStatus(job.id, 'executing', DEMO_USER_ID)).rejects.toThrow(TransitionError);
  });

  it('isolates state between instances', async () => {
    const a = repo();
    await a.createJobFromTemplate({
      orgId: DEMO_ORG_ID, wellId: 'well-lf1', templateId: 'tmpl-drill-vert',
      name: 'Z', createdBy: DEMO_USER_ID,
    });
    const b = repo();
    expect(await b.listJobs(DEMO_ORG_ID)).toHaveLength(3);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run:
```bash
pnpm --filter @valor/core test mock-repository
```
Expected: FAIL — cannot resolve `../src/mock-repository.js`.

- [ ] **Step 5: Write the implementation**

Create `packages/core/src/mock-repository.ts`:
```ts
import type { JobStatus } from './enums';
import { instantiateStages } from './templates';
import { assertJobStatusTransition } from './transitions';
import { createSeed, type SeedData } from './seed';
import type {
  CreateJobFromTemplateInput,
  Repository,
  TemplateBundle,
} from './repository';
import type { Job, JobStatusHistory, JobWithRelations, Stage, Well, JobTemplate } from './types';

export class MockRepository implements Repository {
  private data: SeedData;
  private history: JobStatusHistory[] = [];
  private counter = 0;

  constructor() {
    this.data = createSeed();
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  // Deterministic, strictly-increasing timestamps so status-history ordering is stable in tests.
  private now(): string {
    return new Date(Date.UTC(2026, 5, 7, 12, 0, this.counter)).toISOString();
  }

  async listWells(orgId: string): Promise<Well[]> {
    return this.data.wells.filter((w) => w.orgId === orgId);
  }

  async getWell(id: string): Promise<Well | null> {
    return this.data.wells.find((w) => w.id === id) ?? null;
  }

  async listTemplates(orgId: string): Promise<JobTemplate[]> {
    return this.data.templates.filter((t) => t.orgId === orgId);
  }

  async getTemplate(id: string): Promise<TemplateBundle | null> {
    const template = this.data.templates.find((t) => t.id === id);
    if (!template) return null;
    return {
      template,
      stageDefs: this.data.templateStageDefs.filter((d) => d.templateId === id),
      fieldDefs: this.data.templateFieldDefs.filter((d) => d.templateId === id),
    };
  }

  async listJobs(orgId: string): Promise<Job[]> {
    return this.data.jobs.filter((j) => j.orgId === orgId);
  }

  async getJob(id: string): Promise<JobWithRelations | null> {
    const job = this.data.jobs.find((j) => j.id === id);
    if (!job) return null;
    const well = this.data.wells.find((w) => w.id === job.wellId);
    if (!well) return null;
    return {
      ...job,
      well,
      stages: this.data.stages
        .filter((s) => s.jobId === id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      statusHistory: this.history
        .filter((h) => h.jobId === id)
        .sort((a, b) => a.changedAt.localeCompare(b.changedAt)),
    };
  }

  async createJobFromTemplate(input: CreateJobFromTemplateInput): Promise<Job> {
    const bundle = await this.getTemplate(input.templateId);
    if (!bundle) throw new Error(`Template not found: ${input.templateId}`);

    const job: Job = {
      id: this.nextId('job'),
      orgId: input.orgId,
      wellId: input.wellId,
      wellboreId: input.wellboreId,
      templateId: input.templateId,
      name: input.name,
      jobType: bundle.template.jobType,
      status: 'planned',
      afeNumber: input.afeNumber,
      rigId: input.rigId,
      primaryVendorId: input.primaryVendorId,
      createdBy: input.createdBy,
    };
    this.data.jobs.push(job);

    const newStages = instantiateStages(bundle.stageDefs);
    for (const ns of newStages) {
      const stage: Stage = {
        id: this.nextId('stage'),
        orgId: input.orgId,
        jobId: job.id,
        stageNo: ns.stageNo,
        name: ns.name,
        stageType: ns.stageType,
        status: ns.status,
        sortOrder: ns.sortOrder,
      };
      this.data.stages.push(stage);
    }

    this.history.push({
      id: this.nextId('hist'),
      jobId: job.id,
      fromStatus: null,
      toStatus: 'planned',
      changedBy: input.createdBy,
      changedAt: this.now(),
    });

    return job;
  }

  async advanceJobStatus(jobId: string, to: JobStatus, userId: string, note?: string): Promise<Job> {
    const job = this.data.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    assertJobStatusTransition(job.status, to);
    const from = job.status;
    job.status = to;

    this.history.push({
      id: this.nextId('hist'),
      jobId,
      fromStatus: from,
      toStatus: to,
      changedBy: userId,
      changedAt: this.now(),
      note,
    });

    return job;
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run:
```bash
pnpm --filter @valor/core test mock-repository
```
Expected: PASS — 6 passed.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/repository.ts packages/core/src/seed.ts packages/core/src/mock-repository.ts packages/core/test/mock-repository.test.ts
git commit -m "feat(core): repository interface, VEP seed, and mock adapter"
```

---

## Task 8: Core barrel export + full test/typecheck pass

**Files:**
- Create: `packages/core/src/index.ts`
- Delete: `packages/core/test/smoke.test.ts`

- [ ] **Step 1: Create the barrel export**

Create `packages/core/src/index.ts`:
```ts
export * from './enums';
export * from './types';
export * from './transitions';
export * from './templates';
export * from './validation';
export * from './repository';
export * from './seed';
export * from './mock-repository';
```

- [ ] **Step 2: Remove the smoke test**

Run:
```bash
git rm packages/core/test/smoke.test.ts
```

- [ ] **Step 3: Run the full core test suite and typecheck**

Run:
```bash
pnpm --filter @valor/core test
pnpm --filter @valor/core exec tsc --noEmit
```
Expected: all suites PASS (transitions, templates, validation, mock-repository); tsc exits 0 with no output.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): barrel export; drop smoke test"
```

---

## Task 9: Scaffold the Next.js web app

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/next-env.d.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/lib/repo.ts`

- [ ] **Step 1: Create the web package manifest**

Create `apps/web/package.json`:
```json
{
  "name": "@valor/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@valor/core": "workspace:*",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Create the Next config (transpile the workspace core package)**

Create `apps/web/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@valor/core'],
};

export default nextConfig;
```

- [ ] **Step 3: Create the Next ambient types file**

Create `apps/web/next-env.d.ts`:
```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 4: Create the web tsconfig**

Create `apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Create Tailwind + PostCSS config**

Create `apps/web/tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

Create `apps/web/postcss.config.mjs`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create the repository singleton**

Create `apps/web/lib/repo.ts`:
```ts
import { MockRepository, DEMO_ORG_ID } from '@valor/core';

let instance: MockRepository | null = null;

export function getRepo(): MockRepository {
  if (!instance) instance = new MockRepository();
  return instance;
}

export { DEMO_ORG_ID };
```

- [ ] **Step 7: Install workspace dependencies**

Run:
```bash
pnpm install
```
Expected: installs Next/React/Tailwind into `apps/web`, links `@valor/core` via `workspace:*`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/next.config.mjs apps/web/next-env.d.ts apps/web/tsconfig.json apps/web/tailwind.config.ts apps/web/postcss.config.mjs apps/web/lib/repo.ts pnpm-lock.yaml
git commit -m "chore(web): scaffold Next.js app wired to @valor/core mock repo"
```

---

## Task 10: App shell and root layout

**Files:**
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/components/app-shell.tsx`
- Create: `apps/web/app/(hub)/layout.tsx`

- [ ] **Step 1: Create global styles**

Create `apps/web/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: Create the root layout**

Create `apps/web/app/layout.tsx`:
```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Valor Operations Hub',
  description: 'Oilfield E&P operations hub',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Redirect the index route to /jobs**

Create `apps/web/app/page.tsx`:
```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/jobs');
}
```

- [ ] **Step 4: Create the app shell (sidebar nav + static asset tree)**

The asset tree is a static placeholder in Plan 1; Plan 2 makes it data-driven.

Create `apps/web/components/app-shell.tsx`:
```tsx
import Link from 'next/link';

const NAV = [{ href: '/jobs', label: 'Active Jobs' }];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-slate-900 p-4 text-slate-100">
        <div className="mb-6 text-lg font-semibold">Valor Ops</div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded px-3 py-2 text-sm hover:bg-slate-700"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 text-xs uppercase tracking-wide text-slate-400">Assets</div>
        <div className="mt-2 text-sm leading-7 text-slate-300">
          ▾ Ross County Field
          <br />
          &nbsp;&nbsp;▾ Lease Free Pad
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;● Lease Free #1
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Create the hub route-group layout**

Create `apps/web/app/(hub)/layout.tsx`:
```tsx
import { AppShell } from '@/components/app-shell';

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/globals.css apps/web/app/layout.tsx apps/web/app/page.tsx apps/web/components/app-shell.tsx "apps/web/app/(hub)/layout.tsx"
git commit -m "feat(web): root layout and app shell"
```

---

## Task 11: KPI strip, jobs board, and the Active Jobs page

**Files:**
- Create: `apps/web/components/kpi-strip.tsx`
- Create: `apps/web/components/jobs-board.tsx`
- Create: `apps/web/app/(hub)/jobs/page.tsx`

> NPT-hours KPI is intentionally deferred to Plan 3 (it needs the `events` table). Plan 1 shows Active / Executing / Planned counts.

- [ ] **Step 1: Create the KPI strip**

Create `apps/web/components/kpi-strip.tsx`:
```tsx
import type { Job } from '@valor/core';

export function KpiStrip({ jobs }: { jobs: Job[] }) {
  const active = jobs.filter((j) => ['mobilized', 'executing', 'suspended'].includes(j.status)).length;
  const executing = jobs.filter((j) => j.status === 'executing').length;
  const planned = jobs.filter((j) => j.status === 'planned').length;

  const cards = [
    { label: 'Active jobs', value: active },
    { label: 'Executing', value: executing },
    { label: 'Planned', value: planned },
  ];

  return (
    <div className="mb-6 grid grid-cols-3 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg bg-white p-4 shadow-sm">
          <div className="text-2xl font-semibold">{c.value}</div>
          <div className="text-sm text-slate-500">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the jobs board**

Create `apps/web/components/jobs-board.tsx`:
```tsx
import type { Job, JobStatus } from '@valor/core';

const COLUMNS: { status: JobStatus; title: string }[] = [
  { status: 'planned', title: 'Planned' },
  { status: 'mobilized', title: 'Mobilized' },
  { status: 'executing', title: 'Executing' },
  { status: 'complete', title: 'Complete' },
];

export function JobsBoard({ jobs }: { jobs: Job[] }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colJobs = jobs.filter((j) => j.status === col.status);
        return (
          <div key={col.status} className="rounded-lg bg-slate-200/60 p-3">
            <div className="mb-3 text-sm font-medium text-slate-600">
              {col.title} <span className="text-slate-400">({colJobs.length})</span>
            </div>
            <div className="space-y-2">
              {colJobs.map((j) => (
                <div key={j.id} className="rounded-md bg-white p-3 shadow-sm">
                  <div className="text-sm font-medium">{j.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {j.jobType} · {j.afeNumber ?? 'no AFE'}
                  </div>
                </div>
              ))}
              {colJobs.length === 0 && <div className="text-xs text-slate-400">—</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create the Active Jobs page**

Create `apps/web/app/(hub)/jobs/page.tsx`:
```tsx
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { KpiStrip } from '@/components/kpi-strip';
import { JobsBoard } from '@/components/jobs-board';

export default async function JobsPage() {
  const repo = getRepo();
  const jobs = await repo.listJobs(DEMO_ORG_ID);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Active Jobs</h1>
      <KpiStrip jobs={jobs} />
      <JobsBoard jobs={jobs} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and build the web app**

Run:
```bash
pnpm --filter @valor/web exec tsc --noEmit
pnpm --filter @valor/web build
```
Expected: tsc exits 0; `next build` completes, compiling `/` and `/jobs` with no type errors.

- [ ] **Step 5: Manual smoke check (dev server)**

Run:
```bash
pnpm --filter @valor/web dev
```
Then open `http://localhost:3000`. Expected: redirects to `/jobs`; sidebar shows "Valor Ops" + the asset tree; the KPI strip shows Active=2, Executing=1, Planned=1; the board shows "Rig Up & Mobilization" under Mobilized, "Conductor & Surface Drilling" under Executing, and "Production Hole — Air Drill" under Planned. Stop the server with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/kpi-strip.tsx apps/web/components/jobs-board.tsx "apps/web/app/(hub)/jobs/page.tsx"
git commit -m "feat(web): active jobs board and KPI strip on the mock adapter"
```

---

## Task 12: Add web build artifacts to gitignore + README

**Files:**
- Modify: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Ensure Next build output is ignored**

The root `.gitignore` already lists `.next/` and `node_modules/`. Confirm `apps/web/.next` is ignored:
```bash
git check-ignore apps/web/.next
```
Expected: prints `apps/web/.next` (it is ignored). If it prints nothing, append `.next/` to `.gitignore`.

- [ ] **Step 2: Create a README**

Create `README.md`:
```markdown
# Valor Operations Hub

Oilfield E&P operator operations hub — job setup, lifecycle + stage execution tracking,
and org/asset consolidation. See `docs/superpowers/specs/` for the design and
`docs/superpowers/plans/` for implementation plans.

## Monorepo
- `packages/core` — domain types, Zod schemas, transition/validation logic, repository
  interface, and the in-memory mock adapter (frontend-first; Supabase adapter lands in Plan 4).
- `apps/web` — Next.js 15 web app (the operations hub UI).

## Develop
```bash
corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm test          # run @valor/core unit tests
pnpm dev           # start the web app at http://localhost:3000
```
```

- [ ] **Step 3: Final full verification**

Run:
```bash
pnpm test
pnpm --filter @valor/web build
```
Expected: core tests all pass; web build succeeds.

- [ ] **Step 4: Commit**

```bash
git add .gitignore README.md
git commit -m "docs: project README; confirm build artifacts ignored"
```

---

## Definition of Done (Plan 1)

- `pnpm test` runs all `@valor/core` suites green (transitions, templates, validation, mock-repository).
- `pnpm --filter @valor/web build` succeeds.
- `pnpm dev` serves the Active Jobs board at `/jobs` rendering the seeded VEP jobs from the mock adapter.
- The UI imports only from `@valor/core` + `@/lib/repo` — no backend coupling, so Plan 4 can swap in the Supabase adapter behind the `Repository` interface.

## Next plans
- **Plan 2** — Asset hierarchy module (wells/wellbores/formations/casing views) + shadcn/ui + `frontend-design` polish; data-driven asset tree.
- **Plan 3** — Templates editor, job create-from-template wizard, tabbed job detail (stages, inputs via `field_values`, events/NPT, attachments).
- **Plan 4** — Supabase backend: migrations, RLS, Auth, Storage, `SupabaseRepository` (swap behind the interface), generated types, pgTAP, Playwright golden path.
