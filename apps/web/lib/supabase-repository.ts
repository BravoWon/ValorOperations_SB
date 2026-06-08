import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import {
  assertJobStatusTransition,
  createDefaultDashboard,
  instantiateStages,
  isValidDashboardLayout,
  type Asset,
  type AssetTreeNode,
  type CasingString,
  type CreateJobFromTemplateInput,
  type DashboardLayout,
  type Formation,
  type Job,
  type JobStatus,
  type JobStatusHistory,
  type JobTemplate,
  type JobWithRelations,
  type Pad,
  type Repository,
  type Stage,
  type TemplateBundle,
  type TemplateFieldDef,
  type TemplateStageDef,
  type Well,
  type WellboreType,
  type WellDetail,
  type WellboreDetail,
} from '@valor/core';
import type { ChannelDef } from '@valor/core';
import type { Vendor, AfeLine } from '@valor/core';
import type { WellSetup } from '@valor/core';
import type { RigDay } from '@valor/core';

/**
 * SupabaseRepository — the real backend adapter (SCAFFOLD).
 *
 * Implements the full @valor/core `Repository` interface against Supabase via
 * @supabase/supabase-js. Every query is scoped by `org_id` (defence in depth on
 * top of the RLS policies in supabase/migrations/0002_rls.sql). Condition- and
 * activity-state tables map to typed columns; module persistence (the save/load
 * methods) uses the JSONB `payload` module tables so the store stays interchangeable with
 * the in-memory MockRepository.
 *
 * Construct it with a SupabaseClient and a resolved org id (see lib/repo.ts).
 * It is NOT verified against a live database in this scaffold — the verifiable
 * surface is the typecheck against `Repository` and the mocked-client tests.
 */
export class SupabaseRepository implements Repository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly orgId: string,
  ) {}

  // --- helpers ---------------------------------------------------------------

  private fail(error: PostgrestError | { message?: string } | null, context: string): never {
    const message = error?.message ?? 'unknown error';
    throw new Error(`SupabaseRepository.${context} failed: ${message}`);
  }

  // --- condition-state: read -------------------------------------------------

  async listWells(orgId: string): Promise<Well[]> {
    const { data, error } = await this.client.from('wells').select('*').eq('org_id', orgId);
    if (error) this.fail(error, 'listWells');
    return (data ?? []).map(rowToWell);
  }

  async getWell(id: string): Promise<Well | null> {
    const { data, error } = await this.client
      .from('wells')
      .select('*')
      .eq('org_id', this.orgId)
      .eq('id', id)
      .maybeSingle();
    if (error) this.fail(error, 'getWell');
    return data ? rowToWell(data) : null;
  }

  async listAssets(orgId: string): Promise<Asset[]> {
    const { data, error } = await this.client.from('assets').select('*').eq('org_id', orgId);
    if (error) this.fail(error, 'listAssets');
    return (data ?? []).map(rowToAsset);
  }

  async getAssetTree(orgId: string): Promise<AssetTreeNode[]> {
    const [assetsRes, padsRes, wellsRes] = await Promise.all([
      this.client.from('assets').select('*').eq('org_id', orgId),
      this.client.from('pads').select('*').eq('org_id', orgId),
      this.client.from('wells').select('*').eq('org_id', orgId),
    ]);
    if (assetsRes.error) this.fail(assetsRes.error, 'getAssetTree(assets)');
    if (padsRes.error) this.fail(padsRes.error, 'getAssetTree(pads)');
    if (wellsRes.error) this.fail(wellsRes.error, 'getAssetTree(wells)');

    const assets = (assetsRes.data ?? []).map(rowToAsset);
    const pads = (padsRes.data ?? []).map(rowToPad);
    const wells = (wellsRes.data ?? []).map(rowToWell);

    return assets.map((asset) => ({
      asset,
      pads: pads
        .filter((p) => p.assetId === asset.id)
        .map((pad) => ({
          pad,
          wells: wells.filter((w) => w.padId === pad.id),
        })),
    }));
  }

  async getWellDetail(wellId: string): Promise<WellDetail | null> {
    const well = await this.getWell(wellId);
    if (!well) return null;

    const wbRes = await this.client
      .from('wellbores')
      .select('*')
      .eq('org_id', this.orgId)
      .eq('well_id', wellId);
    if (wbRes.error) this.fail(wbRes.error, 'getWellDetail(wellbores)');
    const wellbores = wbRes.data ?? [];
    const wellboreIds = wellbores.map((wb) => wb.id as string);

    let formations: Formation[] = [];
    let casingStrings: CasingString[] = [];
    if (wellboreIds.length > 0) {
      const [fmRes, csgRes] = await Promise.all([
        this.client.from('formations').select('*').eq('org_id', this.orgId).in('wellbore_id', wellboreIds),
        this.client.from('casing_strings').select('*').eq('org_id', this.orgId).in('wellbore_id', wellboreIds),
      ]);
      if (fmRes.error) this.fail(fmRes.error, 'getWellDetail(formations)');
      if (csgRes.error) this.fail(csgRes.error, 'getWellDetail(casing_strings)');
      formations = (fmRes.data ?? []).map(rowToFormation);
      casingStrings = (csgRes.data ?? []).map(rowToCasingString);
    }

    const detail: WellboreDetail[] = wellbores.map((wb) => ({
      ...rowToWellbore(wb),
      formations: formations
        .filter((f) => f.wellboreId === wb.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      casingStrings: casingStrings
        .filter((c) => c.wellboreId === wb.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));

    return { well, wellbores: detail };
  }

  async listTemplates(orgId: string): Promise<JobTemplate[]> {
    const { data, error } = await this.client.from('job_templates').select('*').eq('org_id', orgId);
    if (error) this.fail(error, 'listTemplates');
    return (data ?? []).map(rowToTemplate);
  }

  async getTemplate(id: string): Promise<TemplateBundle | null> {
    const tplRes = await this.client
      .from('job_templates')
      .select('*')
      .eq('org_id', this.orgId)
      .eq('id', id)
      .maybeSingle();
    if (tplRes.error) this.fail(tplRes.error, 'getTemplate');
    if (!tplRes.data) return null;

    const [stageRes, fieldRes] = await Promise.all([
      this.client.from('template_stage_defs').select('*').eq('org_id', this.orgId).eq('template_id', id),
      this.client.from('template_field_defs').select('*').eq('org_id', this.orgId).eq('template_id', id),
    ]);
    if (stageRes.error) this.fail(stageRes.error, 'getTemplate(stageDefs)');
    if (fieldRes.error) this.fail(fieldRes.error, 'getTemplate(fieldDefs)');

    return {
      template: rowToTemplate(tplRes.data),
      stageDefs: (stageRes.data ?? []).map(rowToStageDef),
      fieldDefs: (fieldRes.data ?? []).map(rowToFieldDef),
    };
  }

  async listJobs(orgId: string): Promise<Job[]> {
    const { data, error } = await this.client.from('jobs').select('*').eq('org_id', orgId);
    if (error) this.fail(error, 'listJobs');
    return (data ?? []).map(rowToJob);
  }

  async getJob(id: string): Promise<JobWithRelations | null> {
    const jobRes = await this.client
      .from('jobs')
      .select('*')
      .eq('org_id', this.orgId)
      .eq('id', id)
      .maybeSingle();
    if (jobRes.error) this.fail(jobRes.error, 'getJob');
    if (!jobRes.data) return null;
    const job = rowToJob(jobRes.data);

    const well = await this.getWell(job.wellId);
    if (!well) throw new Error(`Job ${id} references missing well ${job.wellId}`);

    const [stageRes, histRes] = await Promise.all([
      this.client.from('stages').select('*').eq('org_id', this.orgId).eq('job_id', id),
      this.client.from('job_status_history').select('*').eq('org_id', this.orgId).eq('job_id', id),
    ]);
    if (stageRes.error) this.fail(stageRes.error, 'getJob(stages)');
    if (histRes.error) this.fail(histRes.error, 'getJob(history)');

    return {
      ...job,
      well,
      stages: (stageRes.data ?? []).map(rowToStage).sort((a, b) => a.sortOrder - b.sortOrder),
      statusHistory: (histRes.data ?? [])
        .map(rowToStatusHistory)
        .sort((a, b) => a.changedAt.localeCompare(b.changedAt)),
    };
  }

  // --- activity-state: mutations ---------------------------------------------

  async createJobFromTemplate(input: CreateJobFromTemplateInput): Promise<Job> {
    const bundle = await this.getTemplate(input.templateId);
    if (!bundle) throw new Error(`Template not found: ${input.templateId}`);

    const jobInsert = {
      org_id: input.orgId,
      well_id: input.wellId,
      wellbore_id: input.wellboreId ?? null,
      template_id: input.templateId,
      name: input.name,
      job_type: bundle.template.jobType,
      status: 'planned',
      afe_number: input.afeNumber ?? null,
      rig_id: input.rigId ?? null,
      primary_vendor_id: input.primaryVendorId ?? null,
      created_by: input.createdBy,
    };
    const jobRes = await this.client.from('jobs').insert(jobInsert).select('*').single();
    if (jobRes.error) this.fail(jobRes.error, 'createJobFromTemplate(job)');
    const job = rowToJob(jobRes.data);

    const newStages = instantiateStages(bundle.stageDefs);
    if (newStages.length > 0) {
      const stageRows = newStages.map((ns) => ({
        org_id: input.orgId,
        job_id: job.id,
        stage_no: ns.stageNo,
        name: ns.name,
        stage_type: ns.stageType,
        status: ns.status,
        sort_order: ns.sortOrder,
      }));
      const stageRes = await this.client.from('stages').insert(stageRows);
      if (stageRes.error) this.fail(stageRes.error, 'createJobFromTemplate(stages)');
    }

    const histRes = await this.client.from('job_status_history').insert({
      org_id: input.orgId,
      job_id: job.id,
      from_status: null,
      to_status: 'planned',
      changed_by: input.createdBy,
    });
    if (histRes.error) this.fail(histRes.error, 'createJobFromTemplate(history)');

    return job;
  }

  async advanceJobStatus(jobId: string, to: JobStatus, userId: string, note?: string): Promise<Job> {
    const jobRes = await this.client
      .from('jobs')
      .select('*')
      .eq('org_id', this.orgId)
      .eq('id', jobId)
      .maybeSingle();
    if (jobRes.error) this.fail(jobRes.error, 'advanceJobStatus(load)');
    if (!jobRes.data) throw new Error(`Job not found: ${jobId}`);
    const job = rowToJob(jobRes.data);

    assertJobStatusTransition(job.status, to);
    const from = job.status;

    const updRes = await this.client
      .from('jobs')
      .update({ status: to })
      .eq('org_id', this.orgId)
      .eq('id', jobId)
      .select('*')
      .single();
    if (updRes.error) this.fail(updRes.error, 'advanceJobStatus(update)');

    const histRes = await this.client.from('job_status_history').insert({
      org_id: this.orgId,
      job_id: jobId,
      from_status: from,
      to_status: to,
      changed_by: userId,
      note: note ?? null,
    });
    if (histRes.error) this.fail(histRes.error, 'advanceJobStatus(history)');

    return rowToJob(updRes.data);
  }

  // --- dashboards (JSONB module table) ---------------------------------------

  async getDashboard(ownerId: string): Promise<DashboardLayout> {
    const { data, error } = await this.client
      .from('dashboards')
      .select('payload')
      .eq('org_id', this.orgId)
      .eq('owner_id', ownerId)
      .maybeSingle();
    if (error) this.fail(error, 'getDashboard');
    const payload = data?.payload as unknown;
    if (isValidDashboardLayout(payload) && payload.ownerId === ownerId) {
      return payload;
    }
    return createDefaultDashboard(ownerId);
  }

  async saveDashboard(layout: DashboardLayout): Promise<void> {
    const { error } = await this.client
      .from('dashboards')
      .upsert(
        { org_id: this.orgId, owner_id: layout.ownerId, payload: layout },
        { onConflict: 'org_id,owner_id' },
      );
    if (error) this.fail(error, 'saveDashboard');
  }

  // --- well setup (JSONB module table) ---------------------------------------

  async saveWellSetup(wellId: string, setup: WellSetup): Promise<void> {
    const { error } = await this.client
      .from('well_setups')
      .upsert(
        { org_id: this.orgId, well_id: wellId, payload: setup },
        { onConflict: 'org_id,well_id' },
      );
    if (error) this.fail(error, 'saveWellSetup');
  }

  async loadWellSetup(wellId: string): Promise<WellSetup | null> {
    const { data, error } = await this.client
      .from('well_setups')
      .select('payload')
      .eq('org_id', this.orgId)
      .eq('well_id', wellId)
      .maybeSingle();
    if (error) this.fail(error, 'loadWellSetup');
    return (data?.payload as WellSetup | undefined) ?? null;
  }

  // --- rig day (JSONB module table) ------------------------------------------

  async saveRigDay(id: string, day: RigDay): Promise<void> {
    const { error } = await this.client
      .from('rig_days')
      .upsert(
        { org_id: this.orgId, rig_day_key: id, payload: day },
        { onConflict: 'org_id,rig_day_key' },
      );
    if (error) this.fail(error, 'saveRigDay');
  }

  async loadRigDay(id: string): Promise<RigDay | null> {
    const { data, error } = await this.client
      .from('rig_days')
      .select('payload')
      .eq('org_id', this.orgId)
      .eq('rig_day_key', id)
      .maybeSingle();
    if (error) this.fail(error, 'loadRigDay');
    return (data?.payload as RigDay | undefined) ?? null;
  }

  // --- channels (JSONB module table, one row per ChannelDef) -----------------

  async saveChannels(channels: ChannelDef[]): Promise<void> {
    const rows = channels.map((ch) => ({ org_id: this.orgId, channel_key: ch.id, payload: ch }));
    const { error } = await this.client
      .from('channels')
      .upsert(rows, { onConflict: 'org_id,channel_key' });
    if (error) this.fail(error, 'saveChannels');
  }

  async loadChannels(): Promise<ChannelDef[] | null> {
    const { data, error } = await this.client
      .from('channels')
      .select('payload')
      .eq('org_id', this.orgId);
    if (error) this.fail(error, 'loadChannels');
    if (!data || data.length === 0) return null;
    return data.map((r) => r.payload as ChannelDef);
  }

  // --- vendors (JSONB module table, one row per Vendor) ----------------------

  async saveVendors(vendors: Vendor[]): Promise<void> {
    const rows = vendors.map((v) => ({ org_id: this.orgId, vendor_key: v.id, payload: v }));
    const { error } = await this.client
      .from('vendors')
      .upsert(rows, { onConflict: 'org_id,vendor_key' });
    if (error) this.fail(error, 'saveVendors');
  }

  async loadVendors(): Promise<Vendor[] | null> {
    const { data, error } = await this.client
      .from('vendors')
      .select('payload')
      .eq('org_id', this.orgId);
    if (error) this.fail(error, 'loadVendors');
    if (!data || data.length === 0) return null;
    return data.map((r) => r.payload as Vendor);
  }

  // --- AFE lines (JSONB module table, one row per AfeLine) -------------------

  async saveAfe(lines: AfeLine[]): Promise<void> {
    const rows = lines.map((l) => ({ org_id: this.orgId, afe_key: l.id, payload: l }));
    const { error } = await this.client
      .from('afe_lines')
      .upsert(rows, { onConflict: 'org_id,afe_key' });
    if (error) this.fail(error, 'saveAfe');
  }

  async loadAfe(): Promise<AfeLine[] | null> {
    const { data, error } = await this.client
      .from('afe_lines')
      .select('payload')
      .eq('org_id', this.orgId);
    if (error) this.fail(error, 'loadAfe');
    if (!data || data.length === 0) return null;
    return data.map((r) => r.payload as AfeLine);
  }
}

// ============================================================================
// Row → domain mappers (snake_case DB columns → camelCase core types).
// Rows are untyped (`any`) because we have no generated Supabase types in this
// scaffold; mapping is centralized here so a later codegen pass is localized.
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function rowToAsset(r: Row): Asset {
  return { id: r.id, orgId: r.org_id, name: r.name, region: r.region ?? undefined };
}

function rowToPad(r: Row): Pad {
  return {
    id: r.id,
    orgId: r.org_id,
    assetId: r.asset_id,
    name: r.name,
    surfaceLat: r.surface_lat ?? undefined,
    surfaceLong: r.surface_long ?? undefined,
  };
}

function rowToWell(r: Row): Well {
  return {
    id: r.id,
    orgId: r.org_id,
    padId: r.pad_id,
    name: r.name,
    apiNumber: r.api_number ?? undefined,
    permitNumber: r.permit_number ?? undefined,
    state: r.state ?? undefined,
    county: r.county ?? undefined,
    township: r.township ?? undefined,
    section: r.section ?? undefined,
    surfaceLat: r.surface_lat ?? undefined,
    surfaceLong: r.surface_long ?? undefined,
    groundElevFt: r.ground_elev_ft ?? undefined,
    kbHeightFt: r.kb_height_ft ?? undefined,
    status: r.status ?? undefined,
    spudDate: r.spud_date ?? undefined,
  };
}

function rowToWellbore(r: Row) {
  return {
    id: r.id,
    orgId: r.org_id,
    wellId: r.well_id,
    designation: r.designation,
    totalMdFt: r.total_md_ft ?? undefined,
    totalTvdFt: r.total_tvd_ft ?? undefined,
    type: (r.kind ?? 'vertical') as WellboreType,
  };
}

function rowToFormation(r: Row): Formation {
  return {
    id: r.id,
    orgId: r.org_id,
    wellboreId: r.wellbore_id,
    name: r.name,
    topMdFt: r.top_ft ?? undefined,
    bottomMdFt: r.bottom_ft ?? undefined,
    lithology: r.lithology ?? undefined,
    targetZone: !!r.target_zone,
    sortOrder: r.sort_order ?? 0,
  };
}

function rowToCasingString(r: Row): CasingString {
  return {
    id: r.id,
    orgId: r.org_id,
    wellboreId: r.wellbore_id,
    stringType: r.role,
    holeDiaIn: r.hole_dia_in ?? undefined,
    setMdFt: r.shoe_md_ft ?? undefined,
    setTvdFt: r.shoe_tvd_ft ?? undefined,
    csgOdIn: r.od_in ?? undefined,
    csgIdIn: r.id_in ?? undefined,
    weightPpf: r.weight_ppf ?? undefined,
    grade: r.grade ?? undefined,
    connection: r.connection ?? undefined,
    tocFt: r.toc_ft ?? undefined,
    cementWeightPpg: r.cement_lead_ppg ?? undefined,
    cementSacks: r.cement_sacks ?? undefined,
    cementExcessPct: undefined,
    sortOrder: r.sort_order ?? 0,
  };
}

function rowToTemplate(r: Row): JobTemplate {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    jobType: r.job_type,
    version: r.version ?? 1,
    isActive: !!r.is_active,
  };
}

function rowToStageDef(r: Row): TemplateStageDef {
  return {
    id: r.id,
    templateId: r.template_id,
    name: r.name,
    stageType: r.stage_type,
    defaultSortOrder: r.sort_order ?? 0,
  };
}

function rowToFieldDef(r: Row): TemplateFieldDef {
  return {
    id: r.id,
    templateId: r.template_id,
    scope: r.scope,
    key: r.key,
    label: r.label,
    dataType: r.data_type,
    unit: r.unit ?? undefined,
    minValue: r.min_value ?? undefined,
    maxValue: r.max_value ?? undefined,
    enumOptions: r.enum_options ?? undefined,
    required: !!r.required,
    sortOrder: r.sort_order ?? 0,
  };
}

function rowToJob(r: Row): Job {
  return {
    id: r.id,
    orgId: r.org_id,
    wellId: r.well_id,
    wellboreId: r.wellbore_id ?? undefined,
    templateId: r.template_id,
    name: r.name,
    jobType: r.job_type,
    status: r.status,
    afeNumber: r.afe_number ?? undefined,
    plannedStart: r.planned_start ?? undefined,
    plannedEnd: r.planned_end ?? undefined,
    actualStart: r.actual_start ?? undefined,
    actualEnd: r.actual_end ?? undefined,
    rigId: r.rig_id ?? undefined,
    primaryVendorId: r.primary_vendor_id ?? undefined,
    createdBy: r.created_by,
  };
}

function rowToStage(r: Row): Stage {
  return {
    id: r.id,
    orgId: r.org_id,
    jobId: r.job_id,
    stageNo: r.stage_no,
    name: r.name,
    stageType: r.stage_type,
    status: r.status,
    plannedStart: r.planned_start ?? undefined,
    actualStart: r.actual_start ?? undefined,
    actualEnd: r.actual_end ?? undefined,
    depthInFt: r.depth_in_ft ?? undefined,
    depthOutFt: r.depth_out_ft ?? undefined,
    notes: r.notes ?? undefined,
    sortOrder: r.sort_order ?? 0,
  };
}

function rowToStatusHistory(r: Row): JobStatusHistory {
  return {
    id: r.id,
    jobId: r.job_id,
    fromStatus: r.from_status ?? null,
    toStatus: r.to_status,
    changedBy: r.changed_by,
    changedAt: r.changed_at,
    note: r.note ?? undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
