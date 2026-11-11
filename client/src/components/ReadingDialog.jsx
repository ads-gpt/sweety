import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { ReadingForm } from '@/components/ReadingForm';
import { api } from '@/lib/api';

/** Modal wrapper around ReadingForm for creating (reading=null) or editing a reading. */
export function ReadingDialog({ open, onOpenChange, reading, defaultDate, onSaved }) {
  const [recent, setRecent] = useState([]);

  // Preload recent readings so the form can warn about duplicate slots / full days instantly.
  useEffect(() => {
    if (!open) return;
    api.listReadings({ limit: 100 }).then((r) => setRecent(r.data)).catch(() => setRecent([]));
  }, [open]);

  const existingForDate = useCallback((date) => recent.filter((r) => r.date === date), [recent]);

  async function submit(values) {
    const res = reading ? await api.updateReading(reading.id, values) : await api.createReading(values);
    toast.success(reading ? 'Reading updated' : 'Reading saved', { description: `${res.reading.value} mg/dl · ${res.reading.slotLabel}` });
    onOpenChange(false);
    onSaved?.(res.reading);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={reading ? 'Edit reading' : 'Add a reading'}
        description={reading ? 'Update the value, slot or date.' : 'Log a blood glucose measurement. You can add up to 4 per day.'}
      >
        <ReadingForm
          key={reading?.id ?? `new-${defaultDate ?? ''}`}
          initial={reading ?? (defaultDate ? { date: defaultDate.date, slot: defaultDate.slot } : undefined)}
          existingForDate={existingForDate}
          onSubmit={submit}
          onCancel={() => onOpenChange(false)}
          submitLabel={reading ? 'Save changes' : 'Save reading'}
        />
      </DialogContent>
    </Dialog>
  );
}
