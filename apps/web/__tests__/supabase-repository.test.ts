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
      order: record('order'),
      // Promise-like: awaiting the builder resolves to the configured result.
      then: (resolve: (v: unknown) => unknown) => resolve(nextResult),
      // maybeSingle()/single() resolve to the result too (for single-row reads).
      maybeSingle: vi.fn(() => Promise.resolve(nextResult)),
      single: vi.fn(() => Promise.resolve(nextResult)),
    };
    return builder;
  });

  const client = { from } as unknown as SupabaseClient;
  return { client, calls, setResult };
}

const lastCall = (calls: RecordedCall[], table: string) =>
  [...calls].reverse().find((c) => c.table === table);

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

    const call = lastCall(calls, 'channels');
    expect(call).toBeDefined();
    const args = opArgs(call, 'upsert');
    expect(args).toBeDefined();
    const rows = args![0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ org_id: ORG, channel_key: 'c1', payload: ch });
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
});
