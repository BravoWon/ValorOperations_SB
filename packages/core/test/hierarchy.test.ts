import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEMO_ORG_ID } from '../src/seed';

function repo() {
  return new MockRepository();
}

describe('hierarchy reads', () => {
  it('listAssets returns the seeded field', async () => {
    const assets = await repo().listAssets(DEMO_ORG_ID);
    expect(assets).toHaveLength(1);
    expect(assets[0]?.name).toBe('Ross County Field');
  });

  it('getAssetTree nests field -> pad -> wells', async () => {
    const tree = await repo().getAssetTree(DEMO_ORG_ID);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.asset.name).toBe('Ross County Field');
    expect(tree[0]?.pads).toHaveLength(1);
    expect(tree[0]?.pads[0]?.wells.map((w) => w.name)).toEqual(['Lease Free #1', 'Lease Free #2']);
  });

  it('getWellDetail returns wellbores with sorted formations and casing', async () => {
    const detail = await repo().getWellDetail('well-lf1');
    expect(detail?.well.apiNumber).toBe('34-141-2-0059-00-00');
    expect(detail?.wellbores).toHaveLength(1);
    const wb = detail!.wellbores[0]!;
    expect(wb.formations.map((f) => f.name)).toEqual([
      'Ohio Shale', 'Packer Shell', 'Trenton Limestone', 'Black River Group',
    ]);
    expect(wb.casingStrings.map((c) => c.stringType)).toEqual(['conductor', 'surface', 'production']);
  });

  it('getWellDetail returns a well with no wellbores (empty state)', async () => {
    const detail = await repo().getWellDetail('well-lf2');
    expect(detail?.well.name).toBe('Lease Free #2');
    expect(detail?.wellbores).toEqual([]);
  });

  it('getWellDetail returns null for an unknown well', async () => {
    expect(await repo().getWellDetail('nope')).toBeNull();
  });
});
