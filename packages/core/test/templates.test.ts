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
