import type { JobStatus } from './enums';
import { instantiateStages } from './templates';
import { assertJobStatusTransition } from './transitions';
import { createSeed, type SeedData } from './seed';
import type {
  CreateJobFromTemplateInput,
  Repository,
  TemplateBundle,
} from './repository';
import type { Asset, Job, JobStatusHistory, JobWithRelations, Stage, Well, JobTemplate } from './types';
import type { AssetTreeNode, WellDetail } from './views';
import { createDefaultDashboard, isValidDashboardLayout, type DashboardLayout } from './widgets/types';

export class MockRepository implements Repository {
  private data: SeedData;
  private history: JobStatusHistory[] = [];
  private counter = 0;
  private tickMs = 0;
  private dashboards = new Map<string, DashboardLayout>();
  private wellSetups = new Map<string, import('./well-setup/types').WellSetup>();
  private rigDays = new Map<string, import('./rig-day/types').RigDay>();

  constructor() {
    this.data = createSeed();
  }

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}-gen-${this.counter}`;
  }

  // Deterministic, strictly-increasing timestamps (decoupled from ID counter) so history ordering is stable in tests.
  private now(): string {
    this.tickMs += 1000;
    return new Date(Date.UTC(2026, 5, 7) + this.tickMs).toISOString();
  }

  async listWells(orgId: string): Promise<Well[]> {
    return this.data.wells.filter((w) => w.orgId === orgId);
  }

  async getWell(id: string): Promise<Well | null> {
    return this.data.wells.find((w) => w.id === id) ?? null;
  }

  async listAssets(orgId: string): Promise<Asset[]> {
    return this.data.assets.filter((a) => a.orgId === orgId);
  }

  async getAssetTree(orgId: string): Promise<AssetTreeNode[]> {
    return this.data.assets
      .filter((a) => a.orgId === orgId)
      .map((asset) => ({
        asset,
        pads: this.data.pads
          .filter((p) => p.assetId === asset.id)
          .map((pad) => ({
            pad,
            wells: this.data.wells.filter((w) => w.padId === pad.id),
          })),
      }));
  }

  async getWellDetail(wellId: string): Promise<WellDetail | null> {
    const well = this.data.wells.find((w) => w.id === wellId);
    if (!well) return null;
    const wellbores = this.data.wellbores
      .filter((wb) => wb.wellId === wellId)
      .map((wb) => ({
        ...wb,
        formations: this.data.formations
          .filter((f) => f.wellboreId === wb.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
        casingStrings: this.data.casingStrings
          .filter((c) => c.wellboreId === wb.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      }));
    return { well, wellbores };
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
    if (!well) throw new Error(`Job ${id} references missing well ${job.wellId}`);
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

  private dashboardKey(ownerId: string): string {
    return `valor:dashboard:${ownerId}`;
  }

  private get browserStorage(): Storage | null {
    const g = globalThis as unknown as { localStorage?: Storage };
    return g.localStorage ?? null;
  }

  async getDashboard(ownerId: string): Promise<DashboardLayout> {
    const store = this.browserStorage;
    if (store) {
      const raw = store.getItem(this.dashboardKey(ownerId));
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (isValidDashboardLayout(parsed) && parsed.ownerId === ownerId) {
            return parsed;
          }
        } catch {
          /* fall through to default */
        }
      }
    } else if (this.dashboards.has(ownerId)) {
      return structuredClone(this.dashboards.get(ownerId)!);
    }
    return createDefaultDashboard(ownerId);
  }

  async saveDashboard(layout: DashboardLayout): Promise<void> {
    const store = this.browserStorage;
    if (store) {
      store.setItem(this.dashboardKey(layout.ownerId), JSON.stringify(layout));
    } else {
      this.dashboards.set(layout.ownerId, structuredClone(layout));
    }
  }

  private wellSetupKey(id: string) { return `valor:wellsetup:${id}`; }

  async saveWellSetup(wellId: string, setup: import('./well-setup/types').WellSetup): Promise<void> {
    const store = this.browserStorage;
    if (store) store.setItem(this.wellSetupKey(wellId), JSON.stringify(setup));
    else this.wellSetups.set(wellId, structuredClone(setup));
  }

  async loadWellSetup(wellId: string): Promise<import('./well-setup/types').WellSetup | null> {
    const store = this.browserStorage;
    if (store) {
      const raw = store.getItem(this.wellSetupKey(wellId));
      if (raw) { try { return JSON.parse(raw) as import('./well-setup/types').WellSetup; } catch { return null; } }
      return null;
    }
    return this.wellSetups.has(wellId) ? structuredClone(this.wellSetups.get(wellId)!) : null;
  }

  private rigDayKey(id: string) { return `valor:rigday:${id}`; }

  async saveRigDay(id: string, day: import('./rig-day/types').RigDay): Promise<void> {
    const store = this.browserStorage;
    if (store) store.setItem(this.rigDayKey(id), JSON.stringify(day));
    else this.rigDays.set(id, structuredClone(day));
  }

  async loadRigDay(id: string): Promise<import('./rig-day/types').RigDay | null> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem(this.rigDayKey(id)); if (raw) { try { return JSON.parse(raw); } catch { return null; } } return null; }
    return this.rigDays.has(id) ? structuredClone(this.rigDays.get(id)!) : null;
  }
}
