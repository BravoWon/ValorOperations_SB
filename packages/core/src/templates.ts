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
