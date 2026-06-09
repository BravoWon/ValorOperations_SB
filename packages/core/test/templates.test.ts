import { describe, it, expect } from 'vitest';
import { instantiateStages, validateTemplateFieldDefs, DEFAULT_TEMPLATE_BUNDLES } from '../src/templates';
import type { TemplateStageDef, TemplateFieldDef } from '../src/types';
import { DEMO_ORG_ID } from '../src/seed';

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
    expect(b.template.orgId).toBe(DEMO_ORG_ID);
    expect(b.stageDefs.length).toBe(3);
    expect(b.stageDefs.every((s) => typeof s.defaultCode === 'string' && s.defaultCode.length > 0)).toBe(true);
    expect(b.fieldDefs.length).toBe(5);
    expect(b.fieldDefs.filter((f) => f.scope === 'job').length).toBe(3);
  });
});
