import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEFAULT_RIG_DAY } from '../src/rig-day/seed';

describe('MockRepository rig day', () => {
  it('null before save', async () => { expect(await new MockRepository().loadRigDay('demo')).toBeNull(); });
  it('round-trips', async () => {
    const r = new MockRepository(); await r.saveRigDay('demo', DEFAULT_RIG_DAY);
    expect((await r.loadRigDay('demo'))?.blocks.length).toBe(DEFAULT_RIG_DAY.blocks.length);
  });
});
