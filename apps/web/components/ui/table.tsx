import * as React from 'react';
import { cn } from '@/lib/utils';

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-auto rounded-md border border-white/[0.06]">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}
function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn(
        'border-b border-gold/20 bg-white/[0.03] [&_tr]:border-b-0',
        className,
      )}
      {...props}
    />
  );
}
function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      className={cn(
        '[&_tr:last-child]:border-0 [&_tr:nth-child(even)]:bg-white/[0.015]',
        className,
      )}
      {...props}
    />
  );
}
function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-white/[0.05] transition-colors hover:bg-gold/[0.06]',
        className,
      )}
      {...props}
    />
  );
}
function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'h-9 px-3 text-left align-middle font-mono text-[0.6875rem] font-medium uppercase tracking-wider text-gold/80',
        className,
      )}
      {...props}
    />
  );
}
function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />;
}
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
