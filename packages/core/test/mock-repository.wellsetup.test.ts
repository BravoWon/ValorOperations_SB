import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEFAULT_WELL_SETUP } from '../src/well-setup/field-defs';

describe('MockRepository well setup', () => {
  it('returns null before any save', async () => {
    const repo = new MockRepository();
    expect(await repo.loadWellSetup('well-x')).toBeNull();
  });
  it('round-trips save/load (in-memory fallback)', async () => {
    const repo = new MockRepository();
    await repo.saveWellSetup('well-x', DEFAULT_WELL_SETUP);
    const loaded = await repo.loadWellSetup('well-x');
    expect(loaded?.header.wellName).toBe(DEFAULT_WELL_SETUP.header.wellName);
  });
});
