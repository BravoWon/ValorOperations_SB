import Link from 'next/link';
import { MapPin, ChevronRight, Layers } from 'lucide-react';
import { getServerRepo } from '@/lib/server-repo';
import { DEMO_ORG_ID } from '@/lib/repo';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/states';

export default async function AssetsPage() {
  const tree = await (await getServerRepo()).getAssetTree(DEMO_ORG_ID);

  return (
    <div>
      <PageHeader
        eyebrow="Portfolio"
        title="Assets"
        subtitle="Operated fields, pads, and wellbores across the Valor Energy Partners footprint."
      />

      {tree.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-6 w-6" strokeWidth={1.5} />}
          title="No assets yet"
          description="Operated fields and wellbores will appear here once the portfolio is loaded."
        />
      ) : (
        <div className="stagger grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {tree.map((node) => {
            const padCount = node.pads.length;
            const wellCount = node.pads.reduce((n, p) => n + p.wells.length, 0);
            return (
              <Card key={node.asset.id} className="lift group">
                <CardHeader className="card-head pb-4">
                  <CardTitle className="text-xl">{node.asset.name}</CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-gold/70" strokeWidth={1.75} />
                    {node.asset.region ?? 'No region'}
                  </div>
                  <div className="mt-1 flex gap-4 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
                    <span>
                      <span className="text-gold-light">{padCount}</span> pad{padCount === 1 ? '' : 's'}
                    </span>
                    <span>
                      <span className="text-gold-light">{wellCount}</span> well
                      {wellCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {node.pads.map((p) => (
                    <div key={p.pad.id}>
                      <div className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-gold/60">
                        {p.pad.name}
                      </div>
                      <ul className="mt-1.5 space-y-0.5">
                        {p.wells.map((w) => (
                          <li key={w.id}>
                            <Link
                              href={`/wells/${w.id}`}
                              className="group/well -mx-2 flex items-center justify-between rounded-sm px-2 py-1 text-sm text-foreground/90 transition-colors hover:bg-white/[0.04] hover:text-gold-light"
                            >
                              {w.name}
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover/well:translate-x-0.5 group-hover/well:text-gold" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
