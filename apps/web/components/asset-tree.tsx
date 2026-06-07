'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AssetTreeNode } from '@valor/core';
import { cn } from '@/lib/utils';

export function AssetTree({ tree }: { tree: AssetTreeNode[] }) {
  const pathname = usePathname();

  if (tree.length === 0) {
    return <div className="px-2 text-sm text-muted-foreground/60">No assets yet</div>;
  }
  return (
    <div className="space-y-4 text-sm">
      {tree.map((node) => (
        <div key={node.asset.id}>
          <div className="flex items-center gap-2 px-2 font-display text-[0.9375rem] font-medium text-cream">
            <span className="h-1.5 w-1.5 rounded-full bg-gold/70" />
            {node.asset.name}
          </div>
          {node.pads.map((p) => (
            <div key={p.pad.id} className="ml-3 mt-2 border-l border-white/[0.06] pl-3">
              <div className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-gold/60">
                {p.pad.name}
              </div>
              <ul className="mt-1 space-y-0.5">
                {p.wells.map((w) => {
                  const active = pathname === `/wells/${w.id}`;
                  return (
                    <li key={w.id}>
                      <Link
                        href={`/wells/${w.id}`}
                        className={cn(
                          'block rounded-sm px-2 py-1 transition-colors',
                          active
                            ? 'bg-gold/12 text-gold-light'
                            : 'text-muted-foreground hover:bg-white/[0.04] hover:text-cream',
                        )}
                      >
                        {w.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
