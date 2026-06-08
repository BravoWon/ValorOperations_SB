import type { CasingString } from '@valor/core';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/states';

const dash = <span className="text-muted-foreground/40">—</span>;

export function CasingTable({ casing }: { casing: CasingString[] }) {
  if (casing.length === 0) return <EmptyState title="No casing program recorded" compact />;
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
            <TableCell className="data text-right text-foreground/85">{c.holeDiaIn ?? dash}</TableCell>
            <TableCell className="data text-right text-foreground/85">{c.setMdFt ?? dash}</TableCell>
            <TableCell className="data text-right text-foreground/85">{c.csgOdIn ?? dash}</TableCell>
            <TableCell className="data text-right text-foreground/85">{c.weightPpf ?? dash}</TableCell>
            <TableCell className="data text-gold-light/90">{c.grade ?? dash}</TableCell>
            <TableCell className="data text-right text-foreground/85">{c.cementSacks ?? dash}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
