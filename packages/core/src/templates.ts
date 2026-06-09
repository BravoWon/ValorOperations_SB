import type { StageStatus } from './enums';
import type { TemplateStageDef, TemplateFieldDef } from './types';
import type { TemplateBundle } from './repository'; // type-only: no runtime cycle
import { DEMO_ORG_ID } from './seed';

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
