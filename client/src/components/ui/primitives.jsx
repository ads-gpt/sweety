import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ---------- Button ---------- */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:brightness-110',
        brand: 'bg-brand text-white shadow-md shadow-primary/30 hover:brightness-110',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
        outline: 'border border-input bg-card hover:bg-muted',
        ghost: 'hover:bg-muted',
        destructive: 'bg-destructive text-white hover:brightness-110',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: { default: 'h-10 px-4', sm: 'h-8 px-3 text-xs', lg: 'h-12 px-6 text-base', icon: 'size-9' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export const Button = React.forwardRef(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';

/* ---------- Input / Label ---------- */
export const Input = React.forwardRef(({ className, invalid, ...props }, ref) => (
  <input
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      'flex h-11 w-full rounded-md border border-input bg-card px-3.5 text-sm shadow-xs transition-shadow placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none disabled:opacity-50',
      invalid && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn('text-sm font-medium leading-none', className)} {...props} />
));
Label.displayName = 'Label';

/** Label + control + inline error, wired for accessibility. */
export function Field({ id, label, error, hint, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------- Card ---------- */
export const Card = ({ className, ...props }) => (
  <div className={cn('rounded-lg border bg-card text-card-foreground shadow-sm shadow-black/[0.03]', className)} {...props} />
);
export const CardHeader = ({ className, ...props }) => <div className={cn('flex flex-col gap-1 p-5 pb-2', className)} {...props} />;
export const CardTitle = ({ className, ...props }) => <h3 className={cn('text-base font-semibold', className)} {...props} />;
export const CardDescription = ({ className, ...props }) => <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
export const CardContent = ({ className, ...props }) => <div className={cn('p-5 pt-2', className)} {...props} />;

/* ---------- Badge / Skeleton / Spinner ---------- */
export const Badge = ({ className, ...props }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', className)} {...props} />
);

export const Skeleton = ({ className, ...props }) => <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;

export const Spinner = ({ className }) => (
  <svg className={cn('size-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
