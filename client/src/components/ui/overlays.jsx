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
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-7 shadow-xl outline-none max-h-[90vh] overflow-y-auto',
          className,
        )}
        {...props}
      >
        <div className="mb-6 space-y-2 pr-6">
          <DialogPrimitive.Title className="text-xl">{title}</DialogPrimitive.Title>
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
      'flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm transition-colors focus-visible:border-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none data-[placeholder]:text-muted-foreground/70',
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
        className={cn('z-[60] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border bg-card p-1 shadow-lg', className)}
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
    <SelectPrimitive.ItemIndicator className="absolute right-2.5"><Check className="size-4" /></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

/* ---------- Tabs ---------- */
export const Tabs = TabsPrimitive.Root;

export const TabsList = ({ className, ...props }) => (
  <TabsPrimitive.List className={cn('inline-flex items-center gap-6 border-b', className)} {...props} />
);

export const TabsTrigger = ({ className, ...props }) => (
  <TabsPrimitive.Trigger
    className={cn(
      '-mb-px inline-flex h-10 cursor-pointer outline-none focus-visible:text-foreground items-center justify-center border-b-2 border-transparent text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground',
      className,
    )}
    {...props}
  />
);

export const TabsContent = TabsPrimitive.Content;
