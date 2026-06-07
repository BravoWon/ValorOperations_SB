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
