import Link from 'next/link';
import type { AssetTreeNode } from '@valor/core';

export function AssetTree({ tree }: { tree: AssetTreeNode[] }) {
  if (tree.length === 0) {
    return <div className="mt-2 text-sm text-slate-400">No assets yet</div>;
  }
  return (
    <div className="mt-2 space-y-3 text-sm">
      {tree.map((node) => (
        <div key={node.asset.id}>
          <div className="font-medium text-slate-200">{node.asset.name}</div>
          {node.pads.map((p) => (
            <div key={p.pad.id} className="ml-2 mt-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">{p.pad.name}</div>
              <ul className="ml-1 mt-0.5">
                {p.wells.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={`/wells/${w.id}`}
                      className="block rounded px-2 py-1 text-slate-300 hover:bg-slate-700"
                    >
                      {w.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
