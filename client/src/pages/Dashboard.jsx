import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import { Button, Skeleton, Status } from '@/components/ui/primitives';
import { PageHeader } from '@/components/AppShell';
import { ReadingDialog } from '@/components/ReadingDialog';
import { ReportBody } from '@/components/ReportView';
import { useAuth } from '@/hooks/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { SLOTS, glucoseStatus, MAX_PER_DAY } from '@/lib/glucose';
import { todayISO, formatDate } from '@/lib/dates';
import { cn } from '@/lib/utils';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Dashboard() {
  const { user } = useAuth();
  const date = todayISO();
  const [dialog, setDialog] = useState({ open: false, reading: null, preset: null });

  const day = useAsync(() => api.report('daily', { date }), [date]);
  const month = useAsync(() => api.report('month-to-date', { date }), [date]);
  const refresh = () => { day.reload(); month.reload(); };

  const bySlot = Object.fromEntries((day.data?.readings ?? []).map((r) => [r.slot, r]));
  const done = day.data?.readings.length ?? 0;
  const open = (reading = null, preset = null) => setDialog({ open: true, reading, preset });

  return (
    <>
      <PageHeader
        eyebrow={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        actions={<Button onClick={() => open()}><Plus />Add reading</Button>}
      />

      <section aria-labelledby="today-heading" className="mb-12">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="today-heading" className="text-2xl">Today</h2>
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
                className="group cursor-pointer px-5 py-4 text-left transition-colors hover:bg-secondary/60"
              >
                <p className="eyebrow">{s.label}</p>
                {r ? (
                  <>
                    <p className="num mt-3 text-[2.5rem] leading-none">{r.value}<span className="ml-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground">mg/dl</span></p>
                    <Status status={glucoseStatus(r.value)} className="mt-3" />
                  </>
                ) : (
                  <>
                    <p className="num mt-3 text-[2.5rem] leading-none text-border">—</p>
                    <p className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground"><Plus className="size-3" />Add reading</p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="mtd-heading" className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 id="mtd-heading" className="text-2xl">This month so far</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/reports">All reports<ArrowRight /></Link></Button>
        </div>
        {month.loading && !month.data ? (
          <Skeleton className="h-28" />
        ) : month.error ? (
          <p role="alert" className="text-sm font-medium text-destructive">{month.error.message}</p>
        ) : (
          <ReportBody report={{ ...month.data, type: 'month-to-date' }} onAdd={() => open()} />
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
