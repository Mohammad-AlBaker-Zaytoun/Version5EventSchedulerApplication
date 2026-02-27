import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants: Record<'default' | 'secondary' | 'destructive' | 'outline', string> = {
  default:
    'border-transparent bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] [&_svg]:text-current',
  secondary: 'border-transparent bg-[var(--surface-muted)] text-[var(--text-secondary)]',
  destructive: 'border-transparent bg-red-600 text-white',
  outline: 'border-[var(--border-subtle)] text-[var(--text-secondary)]',
};

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof badgeVariants }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
