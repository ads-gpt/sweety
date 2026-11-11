import { useState } from 'react';
import { Pencil, Trash2, Plus, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, Status, Skeleton } from '@/components/ui/primitives';
import { Dialog, DialogContent } from '@/components/ui/overlays';
import { PageHeader } from '@/components/AppShell';
import { ReadingDialog } from '@/components/ReadingDialog';
import { EmptyState } from '@/components/ReportView';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { formatDate, todayISO } from '@/lib/dates';
import { glucoseStatus } from '@/lib/glucose';

const PAGE_SIZE = 10;

export default function ReadingsPage() {
  const [page, setPage] = useState(1);
  const [date, setDate] = useState('');
  const [dialog, setDialog] = useState({ open: false, reading: null });
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, error, loading, reload } = useAsync(() => api.listReadings({ page, limit: PAGE_SIZE, date }), [page, date]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.deleteReading(toDelete.id);
      toast.success('Reading deleted');
      setToDelete(null);
      if (data.data.length === 1 && page > 1) setPage(page - 1); else reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  }

  const rows = data?.data ?? [];
  const pg = data?.pagination;

  return (
    <>
      <PageHeader
        title="Readings"
        subtitle="Every measurement you've logged. Edit or delete any of them."
        actions={<Button onClick={() => setDialog({ open: true, reading: null })}><Plus />Add reading</Button>}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">Filter by date</span>
          <input type="date" value={date} max={todayISO()} aria-label="Filter by date" onChange={(e) => { setDate(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-sm focus-visible:border-foreground focus-visible:outline-none" />
        </label>
        {date && <Button variant="ghost" size="sm" onClick={() => { setDate(''); setPage(1); }}><X />Clear</Button>}
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 px-4 py-3 text-sm font-medium text-destructive">{error.message}</p>
      ) : loading && !data ? (
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={date ? 'No readings on this date' : 'No readings yet'}
          text={date ? 'Pick another date or clear the filter.' : 'Add your first glucose reading to start building your reports.'}
          action={<Button onClick={() => setDialog({ open: true, reading: null })}>Add a reading</Button>}
        />
      ) : (
        <Card className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <ul className="divide-y" aria-label="Readings">
            {rows.map((r) => {
              const s = glucoseStatus(r.value);
              return (
                <li key={r.id} className="flex items-center gap-4 px-6 py-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.slotLabel}</p>
                    <p className="truncate text-sm text-muted-foreground">{formatDate(r.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}{r.notes ? ` · ${r.notes}` : ''}</p>
                  </div>
                  <Status status={s} className="hidden sm:inline-flex" />
                  <p className="num w-24 text-right text-2xl">{r.value}<span className="ml-1 font-sans text-xs font-medium tracking-normal text-muted-foreground">mg/dl</span></p>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${r.slotLabel} reading on ${r.date}`} onClick={() => setDialog({ open: true, reading: r })}><Pencil /></Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" aria-label={`Delete ${r.slotLabel} reading on ${r.date}`} onClick={() => setToDelete(r)}><Trash2 /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between border-t px-6 py-4 text-sm">
            <span className="text-muted-foreground">Page {pg.page} of {pg.totalPages} · {pg.total} readings</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={pg.page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft />Prev</Button>
              <Button variant="outline" size="sm" disabled={pg.page >= pg.totalPages} onClick={() => setPage(page + 1)}>Next<ChevronRight /></Button>
            </div>
          </div>
        </Card>
      )}

      <ReadingDialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} reading={dialog.reading} onSaved={reload} />

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent title="Delete this reading?" description={toDelete ? `${toDelete.value} mg/dl · ${toDelete.slotLabel} on ${formatDate(toDelete.date)}. This can't be undone.` : ''}>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>{deleting && <Loader2 className="animate-spin" />}Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
