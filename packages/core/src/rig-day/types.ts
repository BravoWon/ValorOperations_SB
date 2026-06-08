import type { LaneItem } from './lanes';

export interface TimeBlock {
  id: string; code: string; startMin: number; endMin: number;
  depthStartFt?: number; depthEndFt?: number; note?: string;
}
export interface RigDay {
  id: string; label: string; blocks: TimeBlock[];
  people?: LaneItem[];
  equipment?: LaneItem[];
}
export interface CodeTally {
  code: string; label: string; category: string; minutes: number; npt: boolean; billable: boolean;
}
export interface TimeAccounting {
  totalLoggedMin: number; productiveMin: number; nptMin: number;
  byCode: CodeTally[]; unaccountedGaps: { startMin: number; endMin: number }[]; warnings: string[];
}
export const DAY_MINUTES = 1440;
