import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRepo } from '@/lib/repo';
import { WellHeader } from '@/components/well-header';
import { FormationsTable } from '@/components/formations-table';
import { CasingTable } from '@/components/casing-table';
import { Separator } from '@/components/ui/separator';

export default async function WellPage({ params }: { params: Promise<{ wellId: string }> }) {
  const { wellId } = await params;
  const detail = await getRepo().getWellDetail(wellId);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/assets" className="hover:underline">Assets</Link> / {detail.well.name}
      </nav>

      <WellHeader well={detail.well} />

      {detail.wellbores.length === 0 && (
        <p className="text-sm text-muted-foreground">No wellbores recorded for this well yet.</p>
      )}

      {detail.wellbores.map((wb) => (
        <section key={wb.id} className="space-y-4 rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{wb.designation}</h2>
            <span className="text-sm text-muted-foreground capitalize">{wb.type}</span>
            {wb.totalMdFt != null && (
              <span className="text-sm text-muted-foreground">· TD {wb.totalMdFt} ft MD</span>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium">Formations</h3>
            <FormationsTable formations={wb.formations} />
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-sm font-medium">Casing program</h3>
            <CasingTable casing={wb.casingStrings} />
          </div>
        </section>
      ))}
    </div>
  );
}
