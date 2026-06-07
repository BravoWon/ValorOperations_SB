import Link from 'next/link';
import type { AssetTreeNode } from '@valor/core';
import { AssetTree } from '@/components/asset-tree';

const NAV = [
  { href: '/jobs', label: 'Active Jobs' },
  { href: '/assets', label: 'Assets' },
];

export function AppShell({ tree, children }: { tree: AssetTreeNode[]; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-slate-900 p-4 text-slate-100">
        <div className="mb-6 text-lg font-semibold">Valor Ops</div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded px-3 py-2 text-sm hover:bg-slate-700"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 text-xs uppercase tracking-wide text-slate-400">Assets</div>
        <AssetTree tree={tree} />
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
