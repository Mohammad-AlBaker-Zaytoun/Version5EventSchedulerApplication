'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex transform-gpu items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-[transform,box-shadow,background-color,color,border-color,opacity] duration-[520ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:transform-none data-[loading=true]:opacity-100 data-[loading=true]:transform-none ring-offset-background [&_svg]:text-current motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--brand-primary)] text-[var(--brand-primary-foreground)] shadow-[0_8px_20px_-12px_rgba(36,70,232,0.8)] hover:opacity-95 hover:shadow-[0_14px_28px_-16px_rgba(36,70,232,0.92)]',
        secondary:
          'bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-strong)] hover:shadow-[0_12px_24px_-20px_rgba(20,26,50,0.45)]',
        outline:
          'border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] hover:shadow-[0_12px_24px_-20px_rgba(20,26,50,0.35)]',
        destructive:
          'bg-red-600 text-white shadow-[0_8px_20px_-14px_rgba(220,38,38,0.85)] hover:bg-red-700 hover:shadow-[0_14px_28px_-18px_rgba(185,28,28,0.9)]',
        ghost:
          'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-11 rounded-xl px-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-busy={loading || undefined}
        data-loading={loading ? 'true' : undefined}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
        {loading && loadingText ? loadingText : children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
