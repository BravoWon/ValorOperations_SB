import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import { getArea } from '@/lib/areas';

/**
 * Shared branded "coming soon" surface for the not-yet-built workspaces. Reads
 * the area definition by id and renders its icon, title, tagline, description,
 * planned capabilities, and a "Coming soon" badge.
 */
export function ComingSoon({ areaId }: { areaId: string }) {
  const area = getArea(areaId);
  if (!area) notFound();

  const Icon = area.icon;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
      <div className="animate-fade-up glass-strong w-full max-w-2xl rounded-xl px-8 py-12 sm:px-12">
        <div className="flex flex-col items-center text-center">
          <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 text-gold-light shadow-[0_0_28px_-8px_rgba(201,168,76,0.7)]">
            <Icon className="h-7 w-7" />
          </span>

          <div className="eyebrow mb-3">{area.tagline}</div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-cream sm:text-4xl">
            {area.title}
          </h1>

          <span className="mt-4 inline-flex items-center rounded-sm border border-white/10 bg-white/[0.06] px-2.5 py-0.5 font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
            Coming soon
          </span>

          <p className="mt-6 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {area.description}
          </p>
        </div>

        <div className="hairline my-8 h-px" />

        <div>
          <div className="eyebrow mb-4">Planned capabilities</div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {area.capabilities.map((cap) => (
              <li
                key={cap}
                className="flex items-start gap-2.5 text-sm text-muted-foreground/85"
              >
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold/70" />
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
