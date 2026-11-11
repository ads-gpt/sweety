import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/overlays';
import { SLOTS, validateReading, glucoseStatus, MIN_VALUE, MAX_VALUE } from '@/lib/glucose';
import { todayISO } from '@/lib/dates';

/**
 * Add / edit form. `onSubmit({date, slot, value, notes})` should return a promise; if it rejects
 * with an ApiError carrying a `field`, the message is shown next to that field.
 * `existingForDate(date)` returns the readings already saved on that day (for instant duplicate/limit feedback).
 */
export function ReadingForm({ initial, onSubmit, onCancel, existingForDate = () => [], submitLabel = 'Save reading' }) {
  const [form, setForm] = useState({
    date: initial?.date ?? todayISO(),
    slot: initial?.slot ?? '',
    value: initial?.value != null ? String(initial.value) : '',
    notes: initial?.notes ?? '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (valueOrEvent) => {
    const v = valueOrEvent?.target ? valueOrEvent.target.value : valueOrEvent;
    setForm((f) => ({ ...f, [key]: v }));
    setErrors((e) => ({ ...e, [key]: undefined, ...(key === 'date' ? { slot: undefined } : {}) }));
    setFormError('');
  };

  const existing = useMemo(
    () => existingForDate(form.date).filter((r) => r.id !== initial?.id),
    [existingForDate, form.date, initial?.id],
  );
  const taken = new Set(existing.map((r) => r.slot));

  // If the chosen date changes and the selected slot is taken there, clear that selection hint.
  useEffect(() => {
    setErrors((e) => (e.slot?.startsWith('You already') && !taken.has(form.slot) ? { ...e, slot: undefined } : e));
  }, [form.date]); // eslint-disable-line react-hooks/exhaustive-deps

  const numeric = Number(form.value);
  const preview = form.value !== '' && Number.isInteger(numeric) && numeric >= MIN_VALUE && numeric <= MAX_VALUE ? glucoseStatus(numeric) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validateReading(form, existing);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await onSubmit({ date: form.date, slot: form.slot, value: Number(form.value), notes: form.notes.trim() || null });
    } catch (err) {
      if (err.field && ['date', 'slot', 'value', 'notes'].includes(err.field)) setErrors({ [err.field]: err.message });
      else setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-label="Reading form">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="reading-date" label="Date" error={errors.date}>
          <Input id="reading-date" type="date" max={todayISO()} value={form.date} onChange={set('date')} invalid={!!errors.date} aria-describedby={errors.date ? 'reading-date-error' : undefined} />
        </Field>
        <Field id="reading-slot" label="Time slot" error={errors.slot}>
          <Select value={form.slot} onValueChange={set('slot')}>
            <SelectTrigger id="reading-slot" invalid={!!errors.slot} aria-label="Time slot">
              <SelectValue placeholder="Select a slot" />
            </SelectTrigger>
            <SelectContent>
              {SLOTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}{taken.has(s.value) ? '  · logged' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field id="reading-value" label="Glucose value (mg/dl)" error={errors.value} hint={`Whole number between ${MIN_VALUE} and ${MAX_VALUE}.`}>
        <div className="relative">
          <Input
            id="reading-value" type="text" inputMode="numeric" autoComplete="off" placeholder="e.g. 112"
            value={form.value} onChange={set('value')} invalid={!!errors.value}
            aria-describedby={errors.value ? 'reading-value-error' : undefined} className="pr-24 text-base font-semibold"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: preview ? preview.color : 'var(--muted-foreground)' }}>
            {preview ? preview.label : 'mg/dl'}
          </span>
        </div>
      </Field>

      <Field id="reading-notes" label="Notes (optional)" error={errors.notes}>
        <Input id="reading-notes" placeholder="Before a walk, felt dizzy…" maxLength={280} value={form.notes} onChange={set('notes')} />
      </Field>

      {formError && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{formError}</p>}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}{submitLabel}
        </Button>
      </div>
    </form>
  );
}
