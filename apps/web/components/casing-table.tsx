import type { CasingString } from '@valor/core';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CasingTable({ casing }: { casing: CasingString[] }) {
  if (casing.length === 0)
    return <p className="text-sm text-muted-foreground/70">No casing program recorded.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>String</TableHead>
          <TableHead className="text-right">Hole (in)</TableHead>
          <TableHead className="text-right">Set (MD ft)</TableHead>
          <TableHead className="text-right">OD (in)</TableHead>
          <TableHead className="text-right">Wt (#/ft)</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead className="text-right">Cement (sx)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {casing.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-display font-medium capitalize text-cream">
              {c.stringType}
            </TableCell>
            <TableCell className="data text-right text-foreground/85">{c.holeDiaIn ?? '—'}</TableCell>
            <TableCell className="data text-right text-foreground/85">{c.setMdFt ?? '—'}</TableCell>
            <TableCell className="data text-right text-foreground/85">{c.csgOdIn ?? '—'}</TableCell>
            <TableCell className="data text-right text-foreground/85">{c.weightPpf ?? '—'}</TableCell>
            <TableCell className="data text-gold-light/90">{c.grade ?? '—'}</TableCell>
            <TableCell className="data text-right text-foreground/85">{c.cementSacks ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
