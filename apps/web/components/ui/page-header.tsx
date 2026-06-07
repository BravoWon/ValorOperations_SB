import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * One page-header pattern for every screen: a mono gold eyebrow, a Zodiak
 * display title, an optional subtitle, and an optional right-aligned action
 * slot. Keeps spacing rhythm and typography identical across surfaces.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'animate-fade-up mb-8 flex flex-wrap items-end justify-between gap-4',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-medium tracking-tight text-cream">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
