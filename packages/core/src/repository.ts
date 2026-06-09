import type { JobStatus } from './enums';
import type { Asset, Job, JobTemplate, JobWithRelations, TemplateFieldDef, TemplateStageDef, Well } from './types';
import type { AssetTreeNode, WellDetail } from './views';
import type { DashboardLayout } from './widgets/types';

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
  listAssets(orgId: string): Promise<Asset[]>;
  getAssetTree(orgId: string): Promise<AssetTreeNode[]>;
  getWellDetail(wellId: string): Promise<WellDetail | null>;
  listTemplates(orgId: string): Promise<JobTemplate[]>;
  getTemplate(id: string): Promise<TemplateBundle | null>;
  listJobs(orgId: string): Promise<Job[]>;
  getJob(id: string): Promise<JobWithRelations | null>;
  createJobFromTemplate(input: CreateJobFromTemplateInput): Promise<Job>;
  advanceJobStatus(jobId: string, to: JobStatus, userId: string, note?: string): Promise<Job>;
  getDashboard(ownerId: string): Promise<DashboardLayout>;
  saveDashboard(layout: DashboardLayout): Promise<void>;
  saveWellSetup(wellId: string, setup: import('./well-setup/types').WellSetup): Promise<void>;
  loadWellSetup(wellId: string): Promise<import('./well-setup/types').WellSetup | null>;
  saveRigDay(id: string, day: import('./rig-day/types').RigDay): Promise<void>;
  loadRigDay(id: string): Promise<import('./rig-day/types').RigDay | null>;
  saveChannels(channels: import('./data-manager/types').ChannelDef[]): Promise<void>;
  loadChannels(): Promise<import('./data-manager/types').ChannelDef[] | null>;
  saveVendors(vendors: import('./office-ops/types').Vendor[]): Promise<void>;
  loadVendors(): Promise<import('./office-ops/types').Vendor[] | null>;
  saveAfe(lines: import('./office-ops/types').AfeLine[]): Promise<void>;
  loadAfe(): Promise<import('./office-ops/types').AfeLine[] | null>;
  saveBankCodes(codes: import('./well-setup/bank').BankCode[]): Promise<void>;
  loadBankCodes(): Promise<import('./well-setup/bank').BankCode[] | null>;
  saveTemplateBundles(bundles: TemplateBundle[]): Promise<void>;
  loadTemplateBundles(): Promise<TemplateBundle[] | null>;
  exportSnapshot(): Promise<import('./local-db/types').LocalDbSnapshot>;
  importSnapshot(snapshot: import('./local-db/types').LocalDbSnapshot): Promise<void>;
  listCollections(): Promise<import('./local-db/types').CollectionInfo[]>;
  resetLocalDb(): Promise<void>;

  // --- coded-object graph (Slice B) ---
  saveCodedObject(obj: import('./coded-object/types').CodedObject): Promise<void>;
  loadCodedObjects(orgId: string, type?: import('./coded-object/types').ObjectType): Promise<import('./coded-object/types').CodedObject[]>;
  saveRelation(rel: import('./coded-object/types').Relation): Promise<void>;
  loadRelations(orgId: string): Promise<import('./coded-object/types').Relation[]>;
  loadCodedGraph(orgId: string): Promise<import('./coded-object/types').CodedGraph>;
  appendTimelineEvent(event: Omit<import('./coded-object/types').TimelineEvent, 'seq'> & { seq?: number }): Promise<import('./coded-object/types').TimelineEvent>;
  loadTimeline(orgId: string, ticketId: string): Promise<import('./coded-object/types').TimelineEvent[]>;
}
