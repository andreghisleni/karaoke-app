import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40',
        outline:
          'border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
      format: {
        default: '',
        rounded: 'rounded-full',
      },
      color: {
        default: '',
        blue: 'bg-blue-500 text-white hover:bg-blue-600 focus-visible:ring-blue-400 dark:bg-blue-600 dark:hover:bg-blue-700',
        green:
          'bg-green-500 text-white hover:bg-green-600 focus-visible:ring-green-400 dark:bg-green-600 dark:hover:bg-green-700',
        red: 'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-400 dark:bg-red-600 dark:hover:bg-red-700',
        yellow:
          'bg-yellow-500 text-white hover:bg-yellow-600 focus-visible:ring-yellow-400 dark:bg-yellow-600 dark:hover:bg-yellow-700',
        purple:
          'bg-purple-500 text-white hover:bg-purple-600 focus-visible:ring-purple-400 dark:bg-purple-600 dark:hover:bg-purple-700',
        pink: 'bg-pink-500 text-white hover:bg-pink-600 focus-visible:ring-pink-400 dark:bg-pink-600 dark:hover:bg-pink-700',
        indigo:
          'bg-indigo-500 text-white hover:bg-indigo-600 focus-visible:ring-indigo-400 dark:bg-indigo-600 dark:hover:bg-indigo-700',
        teal: 'bg-teal-500 text-white hover:bg-teal-600 focus-visible:ring-teal-400 dark:bg-teal-600 dark:hover:bg-teal-700',
        orange:
          'bg-orange-500 text-white hover:bg-orange-600 focus-visible:ring-orange-400 dark:bg-orange-600 dark:hover:bg-orange-700',
        cyan: 'bg-cyan-500 text-white hover:bg-cyan-600 focus-visible:ring-cyan-400 dark:bg-cyan-600 dark:hover:bg-cyan-700',
        emerald:
          'bg-emerald-500 text-white hover:bg-emerald-600 focus-visible:ring-emerald-400 dark:bg-emerald-600 dark:hover:bg-emerald-700',
        rose: 'bg-rose-500 text-white hover:bg-rose-600 focus-visible:ring-rose-400 dark:bg-rose-600 dark:hover:bg-rose-700',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      format: 'default',
      color: 'default',
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  format,
  color,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, format, color, className }))}
      data-slot="button"
      {...props}
    />
  );
}

export { Button, buttonVariants };
