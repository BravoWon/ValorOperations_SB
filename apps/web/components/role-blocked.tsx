// apps/web/components/role-blocked.tsx
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import type { Role } from '@/lib/role';

/** Branded "this route needs a higher role" state for direct visits. */
export function RoleBlocked({ required }: { required: Role }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="animate-fade-up glass-strong w-full max-w-md rounded-xl px-8 py-10 text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold-light shadow-[0_0_28px_-8px_rgba(201,168,76,0.7)]">
          <ShieldAlert className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <div className="eyebrow mb-2">Restricted</div>
        <h1 className="font-display text-2xl font-medium tracking-tight text-cream">
          Not available for your role
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This workspace requires the{' '}
          <span className="font-mono uppercase tracking-wider text-gold-light">{required}</span> role or higher.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center rounded-md border border-gold/30 bg-gold/[0.06] px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
