import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, GitBranch, Layers, Ruler, PencilRuler } from 'lucide-react';
import { getRepo } from '@/lib/repo';
import { WellHeader } from '@/components/well-header';
import { FormationsTable } from '@/components/formations-table';
import { CasingTable } from '@/components/casing-table';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/states';

export default async function WellPage({ params }: { params: Promise<{ wellId: string }> }) {
  const { wellId } = await params;
  const detail = await getRepo().getWellDetail(wellId);
  if (!detail) notFound();

  return (
    <div className="stagger space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <Link href="/assets" className="transition-colors hover:text-gold-light">
            Assets
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
          <span className="text-cream">{detail.well.name}</span>
        </nav>
        <Link
          href={`/wells/${wellId}/setup`}
          className="flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12]"
        >
          <PencilRuler className="h-3.5 w-3.5" strokeWidth={2} />
          Well Setup
        </Link>
      </div>

      <WellHeader well={detail.well} />

      {detail.wellbores.length === 0 && (
        <EmptyState
          icon={<GitBranch className="h-6 w-6" strokeWidth={1.5} />}
          title="No wellbores recorded"
          description="Wellbore designs, formations, and casing programs will appear here once logged."
        />
      )}

      {detail.wellbores.map((wb) => (
        <section key={wb.id} className="glass space-y-5 rounded-lg p-6">
          <div className="flex flex-wrap items-center gap-3">
            <GitBranch className="h-5 w-5 text-gold" strokeWidth={1.75} />
            <h2 className="font-display text-xl font-medium text-cream">{wb.designation}</h2>
            <span className="rounded-sm border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              {wb.type}
            </span>
            {wb.totalMdFt != null && (
              <span className="data ml-auto text-sm text-gold-light/90">
                TD {wb.totalMdFt} ft MD
              </span>
            )}
          </div>

          <div>
            <h3 className="mb-2.5 flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-gold/80">
              <Layers className="h-3.5 w-3.5" strokeWidth={2} />
              Formations
            </h3>
            <FormationsTable formations={wb.formations} />
          </div>

          <Separator />

          <div>
            <h3 className="mb-2.5 flex items-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-gold/80">
              <Ruler className="h-3.5 w-3.5" strokeWidth={2} />
              Casing Program
            </h3>
            <CasingTable casing={wb.casingStrings} />
          </div>
        </section>
      ))}
    </div>
  );
}
