import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEFAULT_CHANNELS } from '../src/data-manager/channels';
import { DEFAULT_RIG_DAY } from '../src/rig-day/seed';

describe('MockRepository local-db', () => {
  it('export → reset → import round-trips (in-memory)', async () => {
    const r = new MockRepository();
    await r.saveChannels(DEFAULT_CHANNELS);
    await r.saveRigDay(DEFAULT_RIG_DAY.id, DEFAULT_RIG_DAY);
    const snap = await r.exportSnapshot();
    expect(snap.collections.channels?.length).toBe(DEFAULT_CHANNELS.length);
    expect(snap.collections.rigDays?.length).toBe(1);

    await r.resetLocalDb();
    expect((await r.listCollections()).every((c) => c.count === 0)).toBe(true);

    await r.importSnapshot(snap);
    expect((await r.loadChannels())?.length).toBe(DEFAULT_CHANNELS.length);
    expect((await r.loadRigDay(DEFAULT_RIG_DAY.id))?.blocks.length).toBe(DEFAULT_RIG_DAY.blocks.length);
  });

  it('importSnapshot tolerates malformed entries without throwing', async () => {
    const r = new MockRepository();
    const bad = {
      version: 1 as const,
      collections: {
        dashboards: [null, { noOwnerId: true }] as never, // malformed → skipped
        channels: DEFAULT_CHANNELS,                        // valid → imported
      },
    };
    await expect(r.importSnapshot(bad)).resolves.toBeUndefined();
    expect((await r.loadChannels())?.length).toBe(DEFAULT_CHANNELS.length);
  });
});
