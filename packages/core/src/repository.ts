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
