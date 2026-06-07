import Link from 'next/link';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default async function AssetsPage() {
  const tree = await getRepo().getAssetTree(DEMO_ORG_ID);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Assets</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tree.map((node) => {
          const padCount = node.pads.length;
          const wellCount = node.pads.reduce((n, p) => n + p.wells.length, 0);
          return (
            <Card key={node.asset.id}>
              <CardHeader>
                <CardTitle>{node.asset.name}</CardTitle>
                <CardDescription>
                  {node.asset.region ?? 'No region'} · {padCount} pad{padCount === 1 ? '' : 's'} ·{' '}
                  {wellCount} well{wellCount === 1 ? '' : 's'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {node.pads.map((p) => (
                  <div key={p.pad.id}>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {p.pad.name}
                    </div>
                    <ul className="mt-1 space-y-1">
                      {p.wells.map((w) => (
                        <li key={w.id}>
                          <Link href={`/wells/${w.id}`} className="text-sm text-primary hover:underline">
                            {w.name}
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
    </div>
  );
}
