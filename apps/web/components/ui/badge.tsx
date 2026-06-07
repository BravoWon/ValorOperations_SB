import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[0.6875rem] font-medium uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'border-gold/40 bg-gold/15 text-gold-light',
        secondary: 'border-white/10 bg-white/[0.06] text-muted-foreground',
        outline: 'border-border/60 text-foreground',
        success: 'border-green/40 bg-green/10 text-green',
        info: 'border-cyan/40 bg-cyan/10 text-cyan',
        danger: 'border-red/40 bg-red/10 text-red',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
