import type { JobStatus } from './enums';
import { summarizeSnapshot } from './local-db/types';
import { instantiateStages } from './templates';
import { assertJobStatusTransition } from './transitions';
import type { Role } from './enums';
import { createSeed, type SeedData, DEMO_ORG_ID } from './seed';
import type { OrgMember, InviteResult } from './members/types';
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
  private channels: import('./data-manager/types').ChannelDef[] | null = null;
  private vendors: import('./office-ops/types').Vendor[] | null = null;
  private afe: import('./office-ops/types').AfeLine[] | null = null;
  private bankCodes: import('./well-setup/bank').BankCode[] | null = null;
  private templateBundles: import('./repository').TemplateBundle[] | null = null;
  private codedObjects: import('./coded-object/types').CodedObject[] | null = null;
  private relationsList: import('./coded-object/types').Relation[] | null = null;
  private timelines: Record<string, import('./coded-object/types').TimelineEvent[]> | null = null;
  private members = new Map<string, OrgMember[]>([
    [DEMO_ORG_ID, [
      { userId: 'demo-owner', email: 'owner@valor.demo', role: 'owner', createdAt: '2026-01-01T00:00:00.000Z' },
      { userId: 'demo-admin', email: 'admin@valor.demo', role: 'admin', createdAt: '2026-01-02T00:00:00.000Z' },
      { userId: 'demo-viewer', email: 'viewer@valor.demo', role: 'viewer', createdAt: '2026-01-03T00:00:00.000Z' },
    ]],
  ]);

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
    if (store) { const raw = store.getItem(this.rigDayKey(id)); if (raw) { try { return JSON.parse(raw) as import('./rig-day/types').RigDay; } catch { return null; } } return null; }
    return this.rigDays.has(id) ? structuredClone(this.rigDays.get(id)!) : null;
  }

  async saveChannels(channels: import('./data-manager/types').ChannelDef[]): Promise<void> {
    const store = this.browserStorage;
    if (store) store.setItem('valor:channels', JSON.stringify(channels));
    else this.channels = structuredClone(channels);
  }

  async loadChannels(): Promise<import('./data-manager/types').ChannelDef[] | null> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:channels'); if (raw) { try { return JSON.parse(raw) as import('./data-manager/types').ChannelDef[]; } catch { return null; } } return null; }
    return this.channels ? structuredClone(this.channels) : null;
  }

  async saveVendors(vendors: import('./office-ops/types').Vendor[]): Promise<void> {
    const store = this.browserStorage;
    if (store) store.setItem('valor:vendors', JSON.stringify(vendors));
    else this.vendors = structuredClone(vendors);
  }

  async loadVendors(): Promise<import('./office-ops/types').Vendor[] | null> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:vendors'); if (raw) { try { return JSON.parse(raw) as import('./office-ops/types').Vendor[]; } catch { return null; } } return null; }
    return this.vendors ? structuredClone(this.vendors) : null;
  }

  async saveAfe(lines: import('./office-ops/types').AfeLine[]): Promise<void> {
    const store = this.browserStorage;
    if (store) store.setItem('valor:afe', JSON.stringify(lines));
    else this.afe = structuredClone(lines);
  }

  async loadAfe(): Promise<import('./office-ops/types').AfeLine[] | null> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:afe'); if (raw) { try { return JSON.parse(raw) as import('./office-ops/types').AfeLine[]; } catch { return null; } } return null; }
    return this.afe ? structuredClone(this.afe) : null;
  }

  async saveBankCodes(codes: import('./well-setup/bank').BankCode[]): Promise<void> {
    const store = this.browserStorage;
    if (store) store.setItem('valor:bankcodes', JSON.stringify(codes));
    else this.bankCodes = structuredClone(codes);
  }

  async loadBankCodes(): Promise<import('./well-setup/bank').BankCode[] | null> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:bankcodes'); if (raw) { try { return JSON.parse(raw) as import('./well-setup/bank').BankCode[]; } catch { return null; } } return null; }
    return this.bankCodes ? structuredClone(this.bankCodes) : null;
  }

  async saveTemplateBundles(bundles: import('./repository').TemplateBundle[]): Promise<void> {
    const store = this.browserStorage;
    if (store) store.setItem('valor:templatebundles', JSON.stringify(bundles));
    else this.templateBundles = structuredClone(bundles);
  }

  async loadTemplateBundles(): Promise<import('./repository').TemplateBundle[] | null> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:templatebundles'); if (raw) { try { return JSON.parse(raw) as import('./repository').TemplateBundle[]; } catch { return null; } } return null; }
    return this.templateBundles ? structuredClone(this.templateBundles) : null;
  }

  async saveCodedObject(obj: import('./coded-object/types').CodedObject): Promise<void> {
    // Upsert by (orgId, id): drop only the same org's object with this id, then append.
    const others = (await this.allCodedObjects()).filter((o) => !(o.id === obj.id && o.orgId === obj.orgId));
    this.writeCodedObjects([...others, structuredClone(obj)]);
  }
  async loadCodedObjects(orgId: string, type?: import('./coded-object/types').ObjectType): Promise<import('./coded-object/types').CodedObject[]> {
    return (await this.allCodedObjects()).filter((o) => o.orgId === orgId && (type === undefined || o.type === type));
  }
  async saveRelation(rel: import('./coded-object/types').Relation): Promise<void> {
    // Upsert by (orgId, id): drop only the same org's relation with this id, then append.
    const others = (await this.allRelations()).filter((r) => !(r.id === rel.id && r.orgId === rel.orgId));
    this.writeRelations([...others, structuredClone(rel)]);
  }
  async loadRelations(orgId: string): Promise<import('./coded-object/types').Relation[]> {
    return (await this.allRelations()).filter((r) => r.orgId === orgId);
  }
  async loadCodedGraph(orgId: string): Promise<import('./coded-object/types').CodedGraph> {
    return { objects: await this.loadCodedObjects(orgId), relations: await this.loadRelations(orgId) };
  }
  async appendTimelineEvent(
    event: Omit<import('./coded-object/types').TimelineEvent, 'seq'> & { seq?: number },
  ): Promise<import('./coded-object/types').TimelineEvent> {
    const { nextSeq } = await import('./coded-object/graph');
    // Single-map store rewritten per append: fine at demo scale, and consistent with the other
    // collections (channels/vendors/afe) which also rewrite their whole value on save.
    const key = this.timelineKey(event.orgId, event.ticketId);
    const map = await this.allTimelines();
    const existing = map[key] ?? [];
    const seq = event.seq ?? nextSeq(existing, event.ticketId);
    const stored: import('./coded-object/types').TimelineEvent = { ...event, seq };
    map[key] = [...existing, structuredClone(stored)];
    this.writeTimelines(map);
    return stored;
  }
  async loadTimeline(orgId: string, ticketId: string): Promise<import('./coded-object/types').TimelineEvent[]> {
    return [...((await this.allTimelines())[this.timelineKey(orgId, ticketId)] ?? [])].sort((a, b) => a.seq - b.seq);
  }
  /** Composite key isolates timelines per (org, ticket) even if ticketIds collide across orgs. */
  private timelineKey(orgId: string, ticketId: string): string { return `${orgId}::${ticketId}`; }

  // --- coded-object storage helpers (browser localStorage or in-memory) ---
  private async allCodedObjects(): Promise<import('./coded-object/types').CodedObject[]> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:codedobjects'); if (raw) { try { return JSON.parse(raw) as import('./coded-object/types').CodedObject[]; } catch { return []; } } return []; }
    return this.codedObjects ? structuredClone(this.codedObjects) : [];
  }
  private writeCodedObjects(list: import('./coded-object/types').CodedObject[]): void {
    const store = this.browserStorage;
    if (store) store.setItem('valor:codedobjects', JSON.stringify(list));
    else this.codedObjects = structuredClone(list);
  }
  private async allRelations(): Promise<import('./coded-object/types').Relation[]> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:relations'); if (raw) { try { return JSON.parse(raw) as import('./coded-object/types').Relation[]; } catch { return []; } } return []; }
    return this.relationsList ? structuredClone(this.relationsList) : [];
  }
  private writeRelations(list: import('./coded-object/types').Relation[]): void {
    const store = this.browserStorage;
    if (store) store.setItem('valor:relations', JSON.stringify(list));
    else this.relationsList = structuredClone(list);
  }
  private async allTimelines(): Promise<Record<string, import('./coded-object/types').TimelineEvent[]>> {
    const store = this.browserStorage;
    if (store) { const raw = store.getItem('valor:timelines'); if (raw) { try { return JSON.parse(raw) as Record<string, import('./coded-object/types').TimelineEvent[]>; } catch { return {}; } } return {}; }
    return this.timelines ? structuredClone(this.timelines) : {};
  }
  private writeTimelines(map: Record<string, import('./coded-object/types').TimelineEvent[]>): void {
    const store = this.browserStorage;
    if (store) store.setItem('valor:timelines', JSON.stringify(map));
    else this.timelines = structuredClone(map);
  }

  async listOrgMembers(orgId: string): Promise<OrgMember[]> {
    return [...(this.members.get(orgId) ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async inviteMember(orgId: string, email: string, role: Role): Promise<InviteResult> {
    const list = this.members.get(orgId) ?? [];
    if (list.some((m) => m.email.toLowerCase() === email.toLowerCase())) return 'already_member';
    // Deterministic createdAt (no Date in @valor/core); sorts after the seeds.
    list.push({ userId: `mock-${email.toLowerCase()}`, email, role, createdAt: '2099-01-01T00:00:00.000Z' });
    this.members.set(orgId, list);
    return 'added';
  }

  async setMemberRole(orgId: string, userId: string, role: Role): Promise<void> {
    const list = this.members.get(orgId) ?? [];
    const target = list.find((m) => m.userId === userId);
    if (!target) return;
    if (role !== 'owner' && target.role === 'owner' && list.filter((m) => m.role === 'owner').length <= 1) {
      throw new Error('cannot demote the last owner');
    }
    target.role = role;
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    const list = this.members.get(orgId) ?? [];
    const target = list.find((m) => m.userId === userId);
    if (!target) return;
    if (target.role === 'owner' && list.filter((m) => m.role === 'owner').length <= 1) {
      throw new Error('cannot remove the last owner');
    }
    this.members.set(orgId, list.filter((m) => m.userId !== userId));
  }

  async exportSnapshot(): Promise<import('./local-db/types').LocalDbSnapshot> {
    const store = this.browserStorage;
    // NOTE: the coded-object graph collections (valor:codedobjects / valor:relations /
    // valor:timelines) are intentionally NOT included in LocalDB snapshots yet — the graph
    // substrate (Slice B) is not wired into the app. Snapshot/restore for it lands when the
    // graph is surfaced (a later slice). resetLocalDb DOES clear them (full valor:* sweep).
    const collections: import('./local-db/types').LocalDbSnapshot['collections'] = {
      dashboards: [], wellSetups: [], rigDays: [], channels: [], vendors: [], afe: [], bankCodes: [], templateBundles: [],
    };
    if (store) {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i); if (!k || !k.startsWith('valor:')) continue;
        const raw = store.getItem(k); if (!raw) continue;
        try {
          if (k.startsWith('valor:dashboard:')) collections.dashboards!.push(JSON.parse(raw));
          else if (k.startsWith('valor:wellsetup:')) collections.wellSetups!.push({ wellId: k.slice('valor:wellsetup:'.length), setup: JSON.parse(raw) });
          else if (k.startsWith('valor:rigday:')) collections.rigDays!.push(JSON.parse(raw));
          else if (k === 'valor:channels') collections.channels = JSON.parse(raw);
          else if (k === 'valor:vendors') collections.vendors = JSON.parse(raw);
          else if (k === 'valor:afe') collections.afe = JSON.parse(raw);
          else if (k === 'valor:bankcodes') collections.bankCodes = JSON.parse(raw);
          else if (k === 'valor:templatebundles') collections.templateBundles = JSON.parse(raw);
        } catch { /* skip malformed */ }
      }
    } else {
      collections.dashboards = [...this.dashboards.values()].map((d) => structuredClone(d));
      collections.wellSetups = [...this.wellSetups.entries()].map(([wellId, setup]) => ({ wellId, setup: structuredClone(setup) }));
      collections.rigDays = [...this.rigDays.values()].map((d) => structuredClone(d));
      collections.channels = this.channels ? structuredClone(this.channels) : [];
      collections.vendors = this.vendors ? structuredClone(this.vendors) : [];
      collections.afe = this.afe ? structuredClone(this.afe) : [];
      collections.bankCodes = this.bankCodes ? structuredClone(this.bankCodes) : [];
      collections.templateBundles = this.templateBundles ? structuredClone(this.templateBundles) : [];
    }
    return { version: 1 as const, collections };
  }

  async importSnapshot(snapshot: import('./local-db/types').LocalDbSnapshot): Promise<void> {
    // Defensive: user-provided JSON. Validate each entry's shape and skip bad
    // ones so a malformed snapshot can't crash the import (spec: never throws).
    const c = (snapshot && typeof snapshot === 'object' ? snapshot.collections : null) ?? {};
    // (coded-object graph collections are not part of the snapshot yet — see exportSnapshot note.)
    const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

    for (const d of arr<import('./widgets/types').DashboardLayout>(c.dashboards)) {
      if (obj(d) && typeof d.ownerId === 'string') { try { await this.saveDashboard(d); } catch { /* skip */ } }
    }
    for (const w of arr<{ wellId: string; setup: import('./well-setup/types').WellSetup }>(c.wellSetups)) {
      if (obj(w) && typeof w.wellId === 'string' && obj(w.setup)) { try { await this.saveWellSetup(w.wellId, w.setup); } catch { /* skip */ } }
    }
    for (const r of arr<import('./rig-day/types').RigDay>(c.rigDays)) {
      if (obj(r) && typeof r.id === 'string') { try { await this.saveRigDay(r.id, r); } catch { /* skip */ } }
    }
    if (Array.isArray(c.channels)) { try { await this.saveChannels(c.channels); } catch { /* skip */ } }
    if (Array.isArray(c.vendors)) { try { await this.saveVendors(c.vendors); } catch { /* skip */ } }
    if (Array.isArray(c.afe)) { try { await this.saveAfe(c.afe); } catch { /* skip */ } }
    if (Array.isArray(c.bankCodes)) { try { await this.saveBankCodes(c.bankCodes); } catch { /* skip */ } }
    if (Array.isArray(c.templateBundles)) { try { await this.saveTemplateBundles(c.templateBundles); } catch { /* skip */ } }
  }

  async listCollections(): Promise<import('./local-db/types').CollectionInfo[]> {
    return summarizeSnapshot(await this.exportSnapshot());
  }

  async resetLocalDb(): Promise<void> {
    const store = this.browserStorage;
    if (store) {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.startsWith('valor:')) keys.push(k); }
      keys.forEach((k) => store.removeItem(k));
    } else {
      this.dashboards.clear(); this.wellSetups.clear(); this.rigDays.clear();
      this.channels = null; this.vendors = null; this.afe = null;
      this.bankCodes = null;
      this.templateBundles = null;
      this.codedObjects = null; this.relationsList = null; this.timelines = null;
    }
  }
}
