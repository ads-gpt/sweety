import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import { Button, Skeleton, Status } from '@/components/ui/primitives';
import { PageHeader } from '@/components/AppShell';
import { ReadingDialog } from '@/components/ReadingDialog';
import { ReportBody, CommentList } from '@/components/ReportView';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { SLOTS, statusMeta, MAX_PER_DAY } from '@/lib/glucose';
import { todayISO, formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const date = todayISO();
  const [dialog, setDialog] = useState({ open: false, reading: null, preset: null });

  const day = useAsync(() => api.report('daily', { date }), [date]);
  const month = useAsync(() => api.report('month-to-date', { date }), [date]);
  const notes = useAsync(() => api.myComments(3), []);
  const refresh = () => { day.reload(); month.reload(); };

  const bySlot = Object.fromEntries((day.data?.readings ?? []).map((r) => [r.slot, r]));
  const done = day.data?.readings.length ?? 0;
  const open = (reading = null, preset = null) => setDialog({ open: true, reading, preset });

  // Greeting follows the hour in the user's own timezone.
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: user.timezone }).format(new Date())) % 24;
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        eyebrow={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        title={`${greeting}, ${user.name.split(' ')[0]}`}
        actions={<Button onClick={() => open()}><Plus />Add reading</Button>}
      />

      <section aria-labelledby="today-heading" className="mb-16">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 id="today-heading" className="text-[1.75rem]">Today</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex gap-1" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={MAX_PER_DAY} aria-label="Readings logged today">
              {Array.from({ length: MAX_PER_DAY }, (_, i) => <span key={i} className={cn('h-1 w-5 rounded-full', i < done ? 'bg-foreground' : 'bg-border')} />)}
            </span>
            {done} of {MAX_PER_DAY} logged
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y overflow-hidden rounded-lg border bg-card lg:grid-cols-4 lg:divide-y-0">
          {SLOTS.map((s) => {
            const r = bySlot[s.value];
            return (
              <button
                key={s.value} type="button"
                onClick={() => (r ? open(r) : open(null, { date, slot: s.value }))}
                aria-label={r ? `Edit ${s.label} reading` : `Add ${s.label} reading`}
                className="group cursor-pointer px-6 py-6 text-left transition-colors hover:bg-secondary/60"
              >
                <p className="eyebrow">{s.label}</p>
                {r ? (
                  <>
                    <p className="num mt-4 text-[2.75rem]">{r.value}<span className="ml-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground">mg/dl</span></p>
                    <Status status={statusMeta(r.status)} className="mt-4" />
                  </>
                ) : (
                  <>
                    <p className="num mt-4 text-[2.75rem] text-border">—</p>
                    <p className="mt-4 flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground"><Plus className="size-3" />Add reading</p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {notes.data?.data.length > 0 && (
        <div className="mb-16"><CommentList comments={notes.data.data} title="From your doctor" /></div>
      )}

      <section aria-labelledby="mtd-heading" className="space-y-5">
        <div className="flex items-baseline justify-between">
          <h2 id="mtd-heading" className="text-[1.75rem]">This month so far</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/reports">All reports<ArrowRight /></Link></Button>
        </div>
        {month.loading && !month.data ? (
          <Skeleton className="h-28" />
        ) : month.error ? (
          <p role="alert" className="text-sm font-medium text-destructive">{month.error.message}</p>
        ) : (
          <ReportBody report={{ ...month.data, type: 'month-to-date' }} onAdd={() => open()} showComments={false} />
        )}
      </section>

      <ReadingDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        reading={dialog.reading}
        defaultDate={dialog.preset}
        onSaved={refresh}
      />
    </>
  );
}
