import { TAGS, tagLabel } from '@/lib/glucose';
import { cn } from '@/lib/utils';

/** Toggleable tag chips used in the reading form and as list filters. */
export function TagPicker({ value = [], onChange, label = 'Tags' }) {
  const toggle = (tag) => onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {TAGS.map((t) => {
        const on = value.includes(t.value);
        return (
          <button
            key={t.value} type="button" aria-pressed={on} onClick={() => toggle(t.value)}
            className={cn('cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-foreground bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground')}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Read-only tag list. */
export function TagList({ tags = [], className }) {
  if (!tags.length) return null;
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      {tags.map((t) => (
        <span key={t} className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{tagLabel(t)}</span>
      ))}
    </span>
  );
}
