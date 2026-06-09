import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEFAULT_TEMPLATE_BUNDLES } from '../src/templates';

describe('MockRepository template bundles', () => {
  it('null before save', async () => {
    expect(await new MockRepository().loadTemplateBundles()).toBeNull();
  });
  it('round-trips and returns an independent clone', async () => {
    const seedId = DEFAULT_TEMPLATE_BUNDLES[0]!.template.id;
    const seedName = DEFAULT_TEMPLATE_BUNDLES[0]!.template.name;
    const r = new MockRepository();
    await r.saveTemplateBundles(DEFAULT_TEMPLATE_BUNDLES);
    const loaded = await r.loadTemplateBundles();
    expect(loaded?.length).toBe(1);
    expect(loaded![0]!.template.id).toBe(seedId);
    loaded![0]!.template.name = 'MUTATED';
    const again = await r.loadTemplateBundles();
    expect(again![0]!.template.name).toBe(seedName);
  });
  it('saved-but-empty reads back as [] (distinct from the null "never saved" sentinel)', async () => {
    const r = new MockRepository();
    await r.saveTemplateBundles([]);
    expect(await r.loadTemplateBundles()).toEqual([]);
  });
  it('resetLocalDb clears persisted template bundles (in-memory path)', async () => {
    const r = new MockRepository();
    await r.saveTemplateBundles(DEFAULT_TEMPLATE_BUNDLES);
    await r.resetLocalDb();
    expect(await r.loadTemplateBundles()).toBeNull();
  });
  it('round-trips template bundles through export/import snapshot', async () => {
    const a = new MockRepository();
    await a.saveTemplateBundles(DEFAULT_TEMPLATE_BUNDLES);
    const snap = await a.exportSnapshot();
    expect(snap.collections.templateBundles?.length).toBe(1);
    const b = new MockRepository();
    await b.importSnapshot(snap);
    expect((await b.loadTemplateBundles())?.length).toBe(1);
  });
});
