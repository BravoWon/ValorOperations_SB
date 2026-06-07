import type { CasingString } from '@valor/core';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function CasingTable({ casing }: { casing: CasingString[] }) {
  if (casing.length === 0) return <p className="text-sm text-muted-foreground">No casing program recorded.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>String</TableHead>
          <TableHead>Hole (in)</TableHead>
          <TableHead>Set (MD ft)</TableHead>
          <TableHead>OD (in)</TableHead>
          <TableHead>Wt (#/ft)</TableHead>
          <TableHead>Grade</TableHead>
          <TableHead>Cement (sx)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {casing.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium capitalize">{c.stringType}</TableCell>
            <TableCell>{c.holeDiaIn ?? '—'}</TableCell>
            <TableCell>{c.setMdFt ?? '—'}</TableCell>
            <TableCell>{c.csgOdIn ?? '—'}</TableCell>
            <TableCell>{c.weightPpf ?? '—'}</TableCell>
            <TableCell>{c.grade ?? '—'}</TableCell>
            <TableCell>{c.cementSacks ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
