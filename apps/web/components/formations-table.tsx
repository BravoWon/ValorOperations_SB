import type { Formation } from '@valor/core';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function FormationsTable({ formations }: { formations: Formation[] }) {
  if (formations.length === 0) return <p className="text-sm text-muted-foreground">No formations recorded.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Formation</TableHead>
          <TableHead>Top (MD ft)</TableHead>
          <TableHead>Bottom (MD ft)</TableHead>
          <TableHead>Target</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {formations.map((f) => (
          <TableRow key={f.id}>
            <TableCell className="font-medium">{f.name}</TableCell>
            <TableCell>{f.topMdFt ?? '—'}</TableCell>
            <TableCell>{f.bottomMdFt ?? '—'}</TableCell>
            <TableCell>{f.targetZone ? <Badge>Target</Badge> : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
