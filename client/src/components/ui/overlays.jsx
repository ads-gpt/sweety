import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { X, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ---------- Dialog ---------- */
export const Dialog = DialogPrimitive.Root;

export function DialogContent({ className, children, title, description, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-2xl outline-none max-h-[90vh] overflow-y-auto',
          className,
        )}
        {...props}
      >
        <div className="mb-5 space-y-1.5 pr-6">
          <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
        </div>
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 cursor-pointer rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/* ---------- Select ---------- */
export const Select = SelectPrimitive.Root;

export const SelectTrigger = React.forwardRef(({ className, children, invalid, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      'flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-card px-3.5 text-sm shadow-xs transition-shadow focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none data-[placeholder]:text-muted-foreground/70',
      invalid && 'border-destructive',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon><ChevronDown className="size-4 opacity-60" /></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectValue = SelectPrimitive.Value;

export function SelectContent({ className, children, ...props }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={6}
        className={cn('z-[60] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-card p-1 shadow-xl', className)}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn('relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-3 pr-8 text-sm outline-none data-[highlighted]:bg-secondary data-[disabled]:opacity-50', className)}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-2.5"><Check className="size-4 text-primary" /></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

/* ---------- Tabs ---------- */
export const Tabs = TabsPrimitive.Root;

export const TabsList = ({ className, ...props }) => (
  <TabsPrimitive.List className={cn('inline-flex h-11 items-center gap-1 rounded-lg bg-muted p-1', className)} {...props} />
);

export const TabsTrigger = ({ className, ...props }) => (
  <TabsPrimitive.Trigger
    className={cn(
      'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3.5 text-sm font-medium text-muted-foreground transition-all data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className,
    )}
    {...props}
  />
);

export const TabsContent = TabsPrimitive.Content;
