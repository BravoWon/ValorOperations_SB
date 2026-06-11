import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelDef } from '@valor/core';
import { SupabaseRepository } from '@/lib/supabase-repository';

/**
 * Mocked-client adapter tests — NO network. We build a chainable stub that
 * records every `.from(table).<op>(...).eq(...)` call and returns a configurable
 * `{ data, error }`, then assert the SupabaseRepository issues the expected
 * org-scoped queries and maps the results to the core view types.
 */

const ORG = 'org-test';

interface RecordedCall {
  table: string;
  ops: { op: string; args: unknown[] }[];
}

/**
 * A thenable, chainable query stub. Every builder method (select/upsert/eq/...)
 * records itself and returns `this`; awaiting it resolves to `{ data, error }`.
 */
function makeClient(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const calls: RecordedCall[] = [];
  let nextResult = result;

  const setResult = (r: { data: unknown; error: unknown }) => {
    nextResult = r;
  };

  const from = vi.fn((table: string) => {
    const current: RecordedCall = { table, ops: [] };
    calls.push(current);

    const record = (op: string) =>
      vi.fn((...args: unknown[]) => {
        current.ops.push({ op, args });
        return builder;
      });

    const builder: Record<string, unknown> = {
      select: record('select'),
      insert: record('insert'),
      upsert: record('upsert'),
      update: record('update'),
      delete: record('delete'),
      eq: record('eq'),
      in: record('in'),
      not: record('not'),
      order: record('order'),
      // Promise-like: awaiting the builder resolves to the configured result.
      then: (resolve: (v: unknown) => unknown) => resolve(nextResult),
      // maybeSingle()/single() resolve to the result too (for single-row reads).
      maybeSingle: vi.fn(() => Promise.resolve(nextResult)),
      single: vi.fn(() => Promise.resolve(nextResult)),
    };
    return builder;
  });

  const rpcCalls: { name: string; params: unknown }[] = [];
  const rpc = vi.fn((name: string, params: unknown) => {
    rpcCalls.push({ name, params });
    return Promise.resolve(nextResult);
  });
  const client = { from, rpc } as unknown as SupabaseClient;
  return { client, calls, rpcCalls, setResult };
}

const lastCall = (calls: RecordedCall[], table: string) =>
  [...calls].reverse().find((c) => c.table === table);

// Most recent call against `table` that recorded op `op` — save methods now make
// two calls per table (upsert + a cleanup delete), so "last call" alone is
// ambiguous; this finds the one carrying the op under test.
const lastCallWithOp = (calls: RecordedCall[], table: string, op: string) =>
  [...calls].reverse().find((c) => c.table === table && c.ops.some((o) => o.op === op));

const opArgs = (call: RecordedCall | undefined, op: string) =>
  call?.ops.find((o) => o.op === op)?.args;

describe('SupabaseRepository (mocked client)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadChannels() selects payloads from channels scoped by org and maps to ChannelDef[]', async () => {
    const ch: ChannelDef = {
      id: 'c1', channelId: 'WITS-1', mnemonic: 'ROP', label: 'Rate of Penetration',
      unit: 'ft/hr', dataType: 'number', dp: 1, source: 'WITS', min: 0, max: 300, enabled: true,
    };
    const { client, calls, setResult } = makeClient();
    setResult({ data: [{ payload: ch }], error: null });

    const repo = new SupabaseRepository(client, ORG);
    const result = await repo.loadChannels();

    const call = lastCall(calls, 'channels');
    expect(call).toBeDefined();
    expect(call!.ops.some((o) => o.op === 'select')).toBe(true);
    expect(opArgs(call, 'eq')).toEqual(['org_id', ORG]);
    expect(result).toEqual([ch]);
  });

  it('saveChannels() upserts payload rows into channels for the org', async () => {
    const ch: ChannelDef = {
      id: 'c1', channelId: 'WITS-1', mnemonic: 'ROP', label: 'Rate of Penetration',
      unit: 'ft/hr', dataType: 'number', dp: 1, source: 'WITS', min: 0, max: 300, enabled: true,
    };
    const { client, calls } = makeClient({ data: null, error: null });

    const repo = new SupabaseRepository(client, ORG);
    await repo.saveChannels([ch]);

    const call = lastCallWithOp(calls, 'channels', 'upsert');
    expect(call).toBeDefined();
    const args = opArgs(call, 'upsert');
    expect(args).toBeDefined();
    const rows = args![0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ org_id: ORG, channel_key: 'c1', payload: ch });
    // The save also reconciles: a cleanup delete scoped to the org removes
    // rows for keys no longer present, with the kept keys quoted in the in-list.
    const del = lastCallWithOp(calls, 'channels', 'delete');
    expect(del).toBeDefined();
    expect(opArgs(del, 'not')).toEqual(['channel_key', 'in', '("c1")']);
  });

  it('listWells(org) selects wells filtered by org_id and maps rows to Well[]', async () => {
    const row = {
      id: 'well-1', org_id: ORG, pad_id: 'pad-1', name: 'Test Well',
      api_number: '00-000', status: 'permitted',
    };
    const { client, calls, setResult } = makeClient();
    setResult({ data: [row], error: null });

    const repo = new SupabaseRepository(client, ORG);
    const wells = await repo.listWells(ORG);

    const call = lastCall(calls, 'wells');
    expect(call).toBeDefined();
    expect(call!.ops.some((o) => o.op === 'select')).toBe(true);
    expect(opArgs(call, 'eq')).toEqual(['org_id', ORG]);
    expect(wells).toHaveLength(1);
    expect(wells[0]).toMatchObject({
      id: 'well-1', orgId: ORG, padId: 'pad-1', name: 'Test Well', apiNumber: '00-000', status: 'permitted',
    });
  });

  it('throws when Supabase returns an error', async () => {
    const { client, setResult } = makeClient();
    setResult({ data: null, error: { message: 'boom' } });

    const repo = new SupabaseRepository(client, ORG);
    await expect(repo.listWells(ORG)).rejects.toThrow(/boom/);
  });

  it('ignores a passed orgId and always scopes to the instance org', async () => {
    const { client, calls } = makeClient({ data: [], error: null });
    const repo = new SupabaseRepository(client, ORG);
    // App callers pass the mock's DEMO_ORG_ID placeholder; a UUID-scoped instance
    // must not crash or cross tenants — it queries this.orgId regardless.
    await repo.listWells('org-other');
    expect(opArgs(lastCall(calls, 'wells'), 'eq')).toEqual(['org_id', ORG]);
    await repo.listJobs('org-other');
    expect(opArgs(lastCall(calls, 'jobs'), 'eq')).toEqual(['org_id', ORG]);
  });

  const MODULE_TABLES = ['dashboards', 'well_setups', 'rig_days', 'channels', 'vendors', 'afe_lines'] as const;

  it('exportSnapshot() queries every org module table; listCollections() summarizes counts', async () => {
    const { client, calls } = makeClient({ data: [], error: null });
    const repo = new SupabaseRepository(client, ORG);

    const snap = await repo.exportSnapshot();
    expect(snap.version).toBe(1);
    for (const table of MODULE_TABLES) {
      const call = lastCall(calls, table);
      expect(call).toBeDefined();
      expect(call!.ops.some((o) => o.op === 'select')).toBe(true);
      expect(opArgs(call, 'eq')).toEqual(['org_id', ORG]);
    }

    // Empty store → every collection summarizes to count 0.
    // listCollections summarizes ALL known collections: the 6 Supabase-backed module
    // tables + two mock-only catalogs (Bank Codes, Templates) that have no cloud table
    // yet, so they summarize to count 0 here.
    const info = await repo.listCollections();
    expect(info.length).toBe(MODULE_TABLES.length + 2);
    expect(info.every((c) => c.count === 0)).toBe(true);
  });

  it('resetLocalDb() deletes this org\'s rows from every module table', async () => {
    const { client, calls } = makeClient({ data: null, error: null });
    const repo = new SupabaseRepository(client, ORG);

    await repo.resetLocalDb();

    for (const table of MODULE_TABLES) {
      const call = lastCall(calls, table);
      expect(call).toBeDefined();
      expect(call!.ops.some((o) => o.op === 'delete')).toBe(true);
      expect(opArgs(call, 'eq')).toEqual(['org_id', ORG]);
    }
  });

  it('importSnapshot() restores valid entries via save* and skips malformed ones', async () => {
    const ch: ChannelDef = {
      id: 'c1', channelId: 'WITS-1', mnemonic: 'ROP', label: 'Rate of Penetration',
      unit: 'ft/hr', dataType: 'number', dp: 1, source: 'WITS', min: 0, max: 300, enabled: true,
    };
    const { client, calls } = makeClient({ data: null, error: null });
    const repo = new SupabaseRepository(client, ORG);

    await repo.importSnapshot({
      version: 1,
      collections: {
        dashboards: [null, { noOwnerId: true }] as never, // malformed → skipped
        channels: [ch],                                    // valid → upserted
      },
    });

    expect(lastCallWithOp(calls, 'channels', 'upsert')).toBeDefined();
    // Both dashboard entries were malformed → saveDashboard never ran, so the table is never touched.
    expect(calls.some((c) => c.table === 'dashboards')).toBe(false);
  });

  it('template-bundle methods throw (mock-only; cloud template tables deferred)', async () => {
    const { client } = makeClient({ data: [], error: null });
    const repo = new SupabaseRepository(client, ORG);
    await expect(repo.saveTemplateBundles([])).rejects.toThrow(/mock-only/i);
    await expect(repo.loadTemplateBundles()).rejects.toThrow(/mock-only/i);
  });

  it('listOrgMembers() calls the org_members RPC and maps rows to OrgMember[]', async () => {
    const { client, rpcCalls, setResult } = makeClient();
    setResult({ data: [{ user_id: 'u1', email: 'a@x.com', role: 'owner', created_at: '2026-01-01T00:00:00Z' }], error: null });
    const repo = new SupabaseRepository(client, ORG);
    const out = await repo.listOrgMembers('org-1');
    expect(rpcCalls.at(-1)).toEqual({ name: 'org_members', params: { p_org_id: 'org-1' } });
    expect(out).toEqual([{ userId: 'u1', email: 'a@x.com', role: 'owner', createdAt: '2026-01-01T00:00:00Z' }]);
  });

  it('inviteMember() calls the invite_member RPC and returns the status', async () => {
    const { client, rpcCalls, setResult } = makeClient();
    setResult({ data: 'added', error: null });
    const repo = new SupabaseRepository(client, ORG);
    const res = await repo.inviteMember('org-1', 'New@x.com', 'viewer');
    expect(rpcCalls.at(-1)).toEqual({ name: 'invite_member', params: { p_org_id: 'org-1', p_email: 'New@x.com', p_role: 'viewer' } });
    expect(res).toBe('added');
  });

  it('setMemberRole() and removeMember() call their RPCs', async () => {
    const { client, rpcCalls } = makeClient({ data: null, error: null });
    const repo = new SupabaseRepository(client, ORG);
    await repo.setMemberRole('org-1', 'u2', 'admin');
    expect(rpcCalls.at(-1)).toEqual({ name: 'set_member_role', params: { p_org_id: 'org-1', p_user_id: 'u2', p_role: 'admin' } });
    await repo.removeMember('org-1', 'u2');
    expect(rpcCalls.at(-1)).toEqual({ name: 'remove_member', params: { p_org_id: 'org-1', p_user_id: 'u2' } });
  });

  it('surfaces an RPC error via fail()', async () => {
    const { client } = makeClient({ data: null, error: { message: 'not authorized' } });
    const repo = new SupabaseRepository(client, ORG);
    await expect(repo.listOrgMembers('org-1')).rejects.toThrow(/listOrgMembers/);
  });
});
