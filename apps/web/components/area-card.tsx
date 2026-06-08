import Link from 'next/link';
import { ArrowUpRight, Check } from 'lucide-react';
import type { AreaDef } from '@/lib/areas';
import { cn } from '@/lib/utils';

/**
 * A single workspace tile on the launcher. Active areas render full-color and
 * link to the live hub; `soon` areas render dimmed/glass and link to their
 * branded coming-soon page. Both are clickable <Link>s so the whole intended
 * system can be walked end-to-end.
 */
export function AreaCard({ area }: { area: AreaDef }) {
  const Icon = area.icon;
  const isActive = area.status === 'active';

  return (
    <Link
      href={area.href}
      aria-label={`${area.title} — ${isActive ? 'open workspace' : 'coming soon'}`}
      className={cn(
        'lift group glass relative flex flex-col rounded-lg p-6',
        isActive
          ? 'border-gold/25'
          : 'border-white/[0.06] opacity-80 hover:opacity-100',
      )}
    >
      {/* Status chip */}
      <div className="mb-5 flex items-start justify-between">
        <span
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-md border transition-colors',
            isActive
              ? 'border-gold/40 bg-gold/10 text-gold-light shadow-[0_0_20px_-8px_rgba(201,168,76,0.6)]'
              : 'border-white/10 bg-white/[0.04] text-muted-foreground/70 group-hover:text-cream',
          )}
        >
          <Icon className="h-5 w-5" />
        </span>

        {isActive ? (
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-gold/40 bg-gold/15 px-2 py-0.5 font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-gold-light">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
            </span>
            Live
          </span>
        ) : (
          <span className="inline-flex items-center rounded-sm border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
            Coming soon
          </span>
        )}
      </div>

      {/* Title + tagline */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h2
            className={cn(
              'font-display text-xl font-medium tracking-tight transition-colors',
              isActive ? 'text-cream' : 'text-cream/85 group-hover:text-cream',
            )}
          >
            {area.title}
          </h2>
          <ArrowUpRight
            className={cn(
              'h-4 w-4 shrink-0 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100',
              isActive ? 'text-gold' : 'text-muted-foreground',
            )}
          />
        </div>
        <p className="mt-0.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-gold/70">
          {area.tagline}
        </p>
      </div>

      {/* Description */}
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        {area.description}
      </p>

      {/* Capabilities */}
      <ul className="mt-auto space-y-1.5 border-t border-gold/[0.1] pt-4">
        {area.capabilities.map((cap) => (
          <li
            key={cap}
            className="flex items-start gap-2 text-[0.8125rem] text-muted-foreground/80"
          >
            <Check
              className={cn(
                'mt-0.5 h-3 w-3 shrink-0',
                isActive ? 'text-gold/70' : 'text-muted-foreground/40',
              )}
            />
            <span>{cap}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
