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
  private counter = 1000;

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
