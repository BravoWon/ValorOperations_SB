import Link from 'next/link';

const NAV = [{ href: '/jobs', label: 'Active Jobs' }];

export function AppShell({ children }: { children: React.ReactNode }) {
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
        {/* TODO(Plan 2): replace this static tree with a data-driven asset hierarchy. */}
        <div className="mt-2 text-sm leading-7 text-slate-300">
          ▾ Ross County Field
          <br />
          &nbsp;&nbsp;▾ Lease Free Pad
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;● Lease Free #1
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
