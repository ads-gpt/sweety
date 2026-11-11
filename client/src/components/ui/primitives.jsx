import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ---------- Button ---------- */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        brand: 'bg-primary text-primary-foreground hover:opacity-90', // alias kept for call sites
        secondary: 'bg-secondary text-secondary-foreground hover:bg-border',
        outline: 'border border-input bg-transparent hover:bg-secondary',
        ghost: 'hover:bg-secondary',
        destructive: 'bg-destructive text-white hover:opacity-90',
        link: 'underline underline-offset-4 hover:opacity-70',
      },
      size: { default: 'h-10 px-4', sm: 'h-8 px-3 text-[13px]', lg: 'h-11 px-6', icon: 'size-9' },
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
      'flex h-10 w-full rounded-md border border-input bg-card px-3 text-sm transition-colors placeholder:text-muted-foreground/60 focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-50',
      invalid && 'border-destructive focus-visible:border-destructive',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Label = React.forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn('text-[13px] font-medium leading-none', className)} {...props} />
));
Label.displayName = 'Label';

/** Label + control + inline error, wired for accessibility. */
export function Field({ id, label, error, hint, children }) {
  return (
    <div className="space-y-1.5">
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
  <div className={cn('rounded-lg border bg-card text-card-foreground', className)} {...props} />
);
export const CardHeader = ({ className, ...props }) => <div className={cn('flex flex-col gap-1 p-5 pb-2', className)} {...props} />;
export const CardTitle = ({ className, ...props }) => <h3 className={cn('text-lg', className)} {...props} />;
export const CardDescription = ({ className, ...props }) => <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
export const CardContent = ({ className, ...props }) => <div className={cn('p-5 pt-3', className)} {...props} />;

/** Small coloured dot + label, e.g. "● In range". Colour carries the meaning; no pill background. */
export function Status({ status, className }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', className)}>
      <span className="size-1.5 rounded-full" style={{ background: status.color }} aria-hidden />
      <span style={{ color: status.color }}>{status.label}</span>
    </span>
  );
}

export const Skeleton = ({ className, ...props }) => <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;

export const Spinner = ({ className }) => (
  <svg className={cn('size-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
