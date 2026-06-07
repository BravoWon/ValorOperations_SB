'use client';
import { registerWidget } from '@/lib/widgets/registry';
import { AssetTree } from '@/components/asset-tree';
import { useRepoData } from '@/lib/use-repo-data';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';

function AssetTreeWidget() {
  const { data } = useRepoData(() => getRepo().getAssetTree(DEMO_ORG_ID));
  return data ? <AssetTree tree={data} /> : <div className="text-xs text-muted-foreground">Loading…</div>;
}

registerWidget(
  { id: 'asset-tree', title: 'Asset Hierarchy', description: 'Fields → pads → wells.', category: 'data', defaultSize: { w: 4, h: 8 }, minSize: { w: 3, h: 4 } },
  AssetTreeWidget,
);
export {};
