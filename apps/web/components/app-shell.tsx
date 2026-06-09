'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { AssetTreeNode } from '@valor/core';
import { BANK_SEED, type BankCode } from '@valor/core';
import { Home } from 'lucide-react';
import { AssetTree } from '@/components/asset-tree';
import { RoleSwitcher } from '@/components/role-switcher';
import { useRole } from '@/components/role-provider';
import { planesForRole } from '@/lib/planes';
import { cn } from '@/lib/utils';
import { getRepo } from '@/lib/repo';
import { BankSearchPalette } from '@/components/bank-search-palette';

export function AppShell({ tree, children }: { tree: AssetTreeNode[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useRole();
  const planes = planesForRole(role);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [bankCodes, setBankCodes] = useState<BankCode[]>(BANK_SEED);

  useEffect(() => {
    let active = true;
    getRepo().loadBankCodes().then((stored) => { if (active && stored) setBankCodes(stored); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="glass-strong sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-y-0 border-l-0 border-r border-r-[rgba(201,168,76,0.18)] px-4 py-6">
        {/* Back-to-workspaces affordance + active-workspace label */}
        <div className="mb-5 px-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-gold-light"
          >
            <Home className="h-3 w-3" />
            Workspaces
          </Link>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_8px_0_rgba(201,168,76,0.7)]" />
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-gold/80">
              Operations Hub
            </span>
          </div>
        </div>

        {/* Brand mark */}
        <Link href="/dashboard" className="group mb-8 flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-gold/40 bg-gold/10 font-display text-lg text-gold-light shadow-[0_0_18px_-6px_rgba(201,168,76,0.6)]">
            V
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-base font-medium tracking-tight text-cream">Valor</span>
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.2em] text-gold/70">Operations</span>
          </span>
        </Link>

        <RoleSwitcher />

        <nav className="space-y-5">
          {planes.map((plane) => {
            const PlaneIcon = plane.icon;
            return (
              <div key={plane.id}>
                <div className="eyebrow mb-2 flex items-center gap-1.5 px-2">
                  <PlaneIcon className="h-3 w-3 text-gold/70" aria-hidden="true" />
                  {plane.label}
                </div>
                <div className="space-y-1">
                  {plane.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                          active
                            ? 'bg-gold/12 text-gold-light'
                            : 'text-muted-foreground hover:bg-white/[0.04] hover:text-cream',
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gold" />
                        )}
                        <Icon className={cn('h-4 w-4', active ? 'text-gold' : 'text-muted-foreground/70')} strokeWidth={1.75} aria-hidden="true" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="hairline my-6 h-px" />

        <div className="eyebrow mb-3 px-2">Asset Hierarchy</div>
        <div className="flex-1">
          <AssetTree tree={tree} />
        </div>

        <div className="mt-6 px-2 pt-4">
          <div className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground/60">
            Valor Energy Partners
          </div>
          <div className="mt-1 font-mono text-[0.625rem] text-muted-foreground/40">
            operations.valorenp.com
          </div>
        </div>
      </aside>

      <main className="flex-1 px-6 py-8 md:px-8 lg:px-10">
        <div className="page-container">{children}</div>
      </main>
      <BankSearchPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} codes={bankCodes} />
    </div>
  );
}
