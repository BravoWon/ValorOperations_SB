import type { Formation } from '@valor/core';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function FormationsTable({ formations }: { formations: Formation[] }) {
  if (formations.length === 0)
    return <p className="text-sm text-muted-foreground/70">No formations recorded.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Formation</TableHead>
          <TableHead className="text-right">Top (MD ft)</TableHead>
          <TableHead className="text-right">Bottom (MD ft)</TableHead>
          <TableHead className="text-right">Target</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {formations.map((f) => (
          <TableRow key={f.id} className={f.targetZone ? 'bg-gold/[0.04]' : undefined}>
            <TableCell className="font-display font-medium text-cream">{f.name}</TableCell>
            <TableCell className="data text-right text-foreground/85">{f.topMdFt ?? '—'}</TableCell>
            <TableCell className="data text-right text-foreground/85">{f.bottomMdFt ?? '—'}</TableCell>
            <TableCell className="text-right">
              {f.targetZone ? (
                <Badge>Target</Badge>
              ) : (
                <span className="text-muted-foreground/40">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
