import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import {
  assertJobStatusTransition,
  createDefaultDashboard,
  instantiateStages,
  isValidDashboardLayout,
  summarizeSnapshot,
  type Asset,
  type AssetTreeNode,
  type CasingString,
  type CollectionInfo,
  type LocalDbSnapshot,
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

  /**
   * Every query in this adapter is scoped to the single org the instance was
   * constructed with (`this.orgId`). The Repository interface accepts an `orgId`
   * argument on some methods because the multi-org MockRepository uses it — here
   * it is intentionally IGNORED and `this.orgId` always wins. (App callers pass
   * the mock's `DEMO_ORG_ID` placeholder; a UUID-scoped Supabase instance must
   * not crash or cross tenants on that, so we neither trust nor reject the arg.)
   */
  private orgScope(_orgId?: string): string {
    return this.orgId;
  }

  /**
   * Reconcile a per-row module table to exactly `keys`: callers save the whole
   * collection, so after upserting the current set we delete this org's rows
   * whose key is not in it — otherwise items the caller removed would be orphaned
   * (an upsert never deletes). An empty `keys` clears the org's rows for that
   * table (the caller emptied the collection).
   */
  private async deleteOrgRowsNotIn(table: string, keyCol: string, keys: string[]): Promise<void> {
    let query = this.client.from(table).delete().eq('org_id', this.orgId);
    if (keys.length > 0) {
      query = query.not(keyCol, 'in', `(${keys.join(',')})`);
    }
    const { error } = await query;
    if (error) this.fail(error, `${table}(cleanup)`);
  }

  // --- condition-state: read -------------------------------------------------

  async listWells(orgId: string): Promise<Well[]> {
    const org = this.orgScope(orgId);
    const { data, error } = await this.client.from('wells').select('*').eq('org_id', org);
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
    const org = this.orgScope(orgId);
    const { data, error } = await this.client.from('assets').select('*').eq('org_id', org);
    if (error) this.fail(error, 'listAssets');
    return (data ?? []).map(rowToAsset);
  }

  async getAssetTree(orgId: string): Promise<AssetTreeNode[]> {
    const org = this.orgScope(orgId);
    const [assetsRes, padsRes, wellsRes] = await Promise.all([
      this.client.from('assets').select('*').eq('org_id', org),
      this.client.from('pads').select('*').eq('org_id', org),
      this.client.from('wells').select('*').eq('org_id', org),
    ]);
    if (assetsRes.error) this.fail(assetsRes.error, 'getAssetTree(assets)');
    if (padsRes.error) this.fail(padsRes.error, 'getAssetTree(pads)');
    if (wellsRes.error) this.fail(wellsRes.error, 'getAssetTree(wells)');

    const assets = (assetsRes.data ?? []).map(rowToAsset);
    const pads = (padsRes.data ?? []).map(rowToPad);
    const wells = (wellsRes.data ?? []).map(rowToWell);

    // Pre-group children by their FK once (O(P + W)) so the tree build is linear
    // rather than the O(A×P + P×W) of repeated .filter() scans per parent.
    const padsByAsset = new Map<string, Pad[]>();
    for (const p of pads) {
      const list = padsByAsset.get(p.assetId);
      if (list) list.push(p);
      else padsByAsset.set(p.assetId, [p]);
    }
    const wellsByPad = new Map<string, Well[]>();
    for (const w of wells) {
      const list = wellsByPad.get(w.padId);
      if (list) list.push(w);
      else wellsByPad.set(w.padId, [w]);
    }

    return assets.map((asset) => ({
      asset,
      pads: (padsByAsset.get(asset.id) ?? []).map((pad) => ({
        pad,
        wells: wellsByPad.get(pad.id) ?? [],
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

    // Pre-group children by wellbore_id once (O(F + C)) so the per-wellbore build
    // is linear, rather than the O(W×(F+C)) of re-scanning both arrays per wellbore.
    const formationsByWb = new Map<string, Formation[]>();
    for (const f of formations) {
      const list = formationsByWb.get(f.wellboreId);
      if (list) list.push(f);
      else formationsByWb.set(f.wellboreId, [f]);
    }
    const casingByWb = new Map<string, CasingString[]>();
    for (const c of casingStrings) {
      const list = casingByWb.get(c.wellboreId);
      if (list) list.push(c);
      else casingByWb.set(c.wellboreId, [c]);
    }

    const detail: WellboreDetail[] = wellbores.map((wb) => ({
      ...rowToWellbore(wb),
      formations: (formationsByWb.get(wb.id as string) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      casingStrings: (casingByWb.get(wb.id as string) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }));

    return { well, wellbores: detail };
  }

  async listTemplates(orgId: string): Promise<JobTemplate[]> {
    const org = this.orgScope(orgId);
    const { data, error } = await this.client.from('job_templates').select('*').eq('org_id', org);
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
    const org = this.orgScope(orgId);
    const { data, error } = await this.client.from('jobs').select('*').eq('org_id', org);
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
    const org = this.orgScope(input.orgId);
    const bundle = await this.getTemplate(input.templateId);
    if (!bundle) throw new Error(`Template not found: ${input.templateId}`);

    const jobInsert = {
      org_id: org,
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
        org_id: org,
        job_id: job.id,
        stage_no: ns.stageNo,
        name: ns.name,
        stage_type: ns.stageType,
        status: ns.status,
        sort_order: ns.sortOrder,
      }));
      const stageRes = await this.client.from('stages').insert(stageRows);
      if (stageRes.error) {
        await this.bestEffortDeleteJob(job.id);
        this.fail(stageRes.error, 'createJobFromTemplate(stages)');
      }
    }

    const histRes = await this.client.from('job_status_history').insert({
      org_id: org,
      job_id: job.id,
      from_status: null,
      to_status: 'planned',
      changed_by: input.createdBy,
    });
    if (histRes.error) {
      await this.bestEffortDeleteJob(job.id);
      this.fail(histRes.error, 'createJobFromTemplate(history)');
    }

    return job;
  }

  /**
   * Best-effort cleanup when the multi-step job create partially fails. This is
   * NOT a true transaction — if this delete itself fails the job row is stranded.
   * The correct fix is a transactional Postgres function (RPC) that creates the
   * job + stages + history atomically; that is deferred to the live-project step
   * (needs the live DB to author/test — see supabase/README.md "Known limitations").
   * Until then this avoids the common partial-create (job row, no stages/history).
   */
  private async bestEffortDeleteJob(jobId: string): Promise<void> {
    try {
      await this.client.from('jobs').delete().eq('org_id', this.orgId).eq('id', jobId);
    } catch {
      /* swallow — best-effort cleanup on an already-failing path */
    }
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
    if (histRes.error) {
      // Best-effort revert so the status change and its audit trail don't diverge
      // (the status was already written). NOT transactional — the proper fix is an
      // atomic RPC; deferred to the live step (see supabase/README.md).
      try {
        await this.client
          .from('jobs')
          .update({ status: from })
          .eq('org_id', this.orgId)
          .eq('id', jobId);
      } catch {
        /* swallow — best-effort revert on an already-failing path */
      }
      this.fail(histRes.error, 'advanceJobStatus(history)');
    }

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
    if (rows.length > 0) {
      const { error } = await this.client
        .from('channels')
        .upsert(rows, { onConflict: 'org_id,channel_key' });
      if (error) this.fail(error, 'saveChannels');
    }
    await this.deleteOrgRowsNotIn('channels', 'channel_key', channels.map((ch) => ch.id));
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
    if (rows.length > 0) {
      const { error } = await this.client
        .from('vendors')
        .upsert(rows, { onConflict: 'org_id,vendor_key' });
      if (error) this.fail(error, 'saveVendors');
    }
    await this.deleteOrgRowsNotIn('vendors', 'vendor_key', vendors.map((v) => v.id));
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
    if (rows.length > 0) {
      const { error } = await this.client
        .from('afe_lines')
        .upsert(rows, { onConflict: 'org_id,afe_key' });
      if (error) this.fail(error, 'saveAfe');
    }
    await this.deleteOrgRowsNotIn('afe_lines', 'afe_key', lines.map((l) => l.id));
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

  // --- local-db / snapshot (aggregate over the JSONB module tables) ----------
  //
  // The "local DB" workbench treats the org's module tables (the JSONB payload
  // stores above — dashboards, well_setups, rig_days, channels, vendors,
  // afe_lines) as one portable bundle. Export gathers them, import restores them
  // through the same save* methods (so validation/upsert rules stay in one
  // place), and reset deletes this org's module rows. Condition- and
  // activity-state tables (wells, jobs, stages, …) are NOT part of the snapshot —
  // they are authored through dedicated flows, not bulk import/reset.

  async exportSnapshot(): Promise<LocalDbSnapshot> {
    const [dashRes, wsRes, rdRes] = await Promise.all([
      this.client.from('dashboards').select('payload').eq('org_id', this.orgId),
      this.client.from('well_setups').select('well_id, payload').eq('org_id', this.orgId),
      this.client.from('rig_days').select('payload').eq('org_id', this.orgId),
    ]);
    if (dashRes.error) this.fail(dashRes.error, 'exportSnapshot(dashboards)');
    if (wsRes.error) this.fail(wsRes.error, 'exportSnapshot(well_setups)');
    if (rdRes.error) this.fail(rdRes.error, 'exportSnapshot(rig_days)');

    const collections: LocalDbSnapshot['collections'] = {
      dashboards: (dashRes.data ?? []).map((r) => r.payload as DashboardLayout),
      wellSetups: (wsRes.data ?? []).map((r) => ({
        wellId: r.well_id as string,
        setup: r.payload as WellSetup,
      })),
      rigDays: (rdRes.data ?? []).map((r) => r.payload as RigDay),
      channels: (await this.loadChannels()) ?? [],
      vendors: (await this.loadVendors()) ?? [],
      afe: (await this.loadAfe()) ?? [],
    };
    return { version: 1 as const, collections };
  }

  async importSnapshot(snapshot: LocalDbSnapshot): Promise<void> {
    // Defensive: user-provided JSON. Validate each entry's shape and skip bad
    // ones so a malformed snapshot can't crash the import (spec: never throws).
    // Restores go through the same save* methods MockRepository uses.
    const c = (snapshot && typeof snapshot === 'object' ? snapshot.collections : null) ?? {};
    const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

    for (const d of arr<DashboardLayout>(c.dashboards)) {
      if (obj(d) && typeof d.ownerId === 'string') { try { await this.saveDashboard(d); } catch { /* skip */ } }
    }
    for (const w of arr<{ wellId: string; setup: WellSetup }>(c.wellSetups)) {
      if (obj(w) && typeof w.wellId === 'string' && obj(w.setup)) { try { await this.saveWellSetup(w.wellId, w.setup); } catch { /* skip */ } }
    }
    for (const r of arr<RigDay>(c.rigDays)) {
      if (obj(r) && typeof r.id === 'string') { try { await this.saveRigDay(r.id, r); } catch { /* skip */ } }
    }
    if (Array.isArray(c.channels)) { try { await this.saveChannels(c.channels); } catch { /* skip */ } }
    if (Array.isArray(c.vendors)) { try { await this.saveVendors(c.vendors); } catch { /* skip */ } }
    if (Array.isArray(c.afe)) { try { await this.saveAfe(c.afe); } catch { /* skip */ } }
  }

  async listCollections(): Promise<CollectionInfo[]> {
    return summarizeSnapshot(await this.exportSnapshot());
  }

  async resetLocalDb(): Promise<void> {
    // Delete this org's module rows. RLS already constrains to the org; the
    // explicit .eq('org_id') is defence in depth and keeps the delete a no-op
    // against an empty table rather than an unfiltered wipe.
    const tables = ['dashboards', 'well_setups', 'rig_days', 'channels', 'vendors', 'afe_lines'] as const;
    for (const table of tables) {
      const { error } = await this.client.from(table).delete().eq('org_id', this.orgId);
      if (error) this.fail(error, `resetLocalDb(${table})`);
    }
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
