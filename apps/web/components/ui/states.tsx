import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Cohesive loading + empty treatments shared across surfaces, replacing
 * scattered bare "Loading…" / "—" text. All match the navy/gold glass look.
 */

/** A single shimmering placeholder bar. */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('skeleton rounded-md', className)} {...props} />;
}

/** A stack of skeleton lines for list/table loading. */
export function SkeletonLines({
  lines = 4,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2.5', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: `${92 - (i % 3) * 14}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Inline loading state with a consistent eyebrow-mono caption. Used inside
 * widget cards and panels where a full skeleton would be too heavy.
 */
export function LoadingState({
  label = 'Loading',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted-foreground/70',
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
      </span>
      {label}
    </div>
  );
}

/**
 * Empty / no-data treatment: a dashed gold-tinted frame with an optional icon
 * and message. Replaces ad-hoc "None" / "No … recorded" strings.
 */
export function EmptyState({
  icon,
  title,
  description,
  className,
  compact = false,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-md border border-dashed border-gold/15 bg-white/[0.012] text-center',
        compact ? 'gap-1.5 px-3 py-6' : 'gap-2 px-6 py-10',
        className,
      )}
    >
      {icon && <div className="text-gold/40">{icon}</div>}
      <div
        className={cn(
          'font-mono uppercase tracking-[0.16em] text-muted-foreground/60',
          compact ? 'text-[0.625rem]' : 'text-[0.6875rem]',
        )}
      >
        {title}
      </div>
      {description && (
        <p className="max-w-xs text-xs text-muted-foreground/50">{description}</p>
      )}
    </div>
  );
}
