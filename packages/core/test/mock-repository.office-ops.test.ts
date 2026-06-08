import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEFAULT_VENDORS } from '../src/office-ops/vendors';
import { DEFAULT_AFE } from '../src/office-ops/afe';

describe('MockRepository office-ops', () => {
  it('null before save', async () => {
    const r = new MockRepository();
    expect(await r.loadVendors()).toBeNull();
    expect(await r.loadAfe()).toBeNull();
  });
  it('round-trips vendors + afe', async () => {
    const r = new MockRepository();
    await r.saveVendors(DEFAULT_VENDORS); await r.saveAfe(DEFAULT_AFE);
    expect((await r.loadVendors())?.length).toBe(DEFAULT_VENDORS.length);
    expect((await r.loadAfe())?.length).toBe(DEFAULT_AFE.length);
  });
});
