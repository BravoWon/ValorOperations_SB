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
