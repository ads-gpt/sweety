import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ArrowRight, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Skeleton } from '@/components/ui/primitives';
import { PageHeader } from '@/components/AppShell';
import { ReadingDialog } from '@/components/ReadingDialog';
import { ReadingChart } from '@/components/ReadingChart';
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
        title={`${greeting()}, ${user.name.split(' ')[0]} 👋`}
        subtitle={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={<Button variant="brand" onClick={() => open()}><Plus />Add reading</Button>}
      />

      {/* Today's four slots */}
      <section aria-labelledby="today-heading" className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="today-heading" className="text-lg font-semibold">Today</h2>
          <span className="text-sm text-muted-foreground">{done} of {MAX_PER_DAY} logged</span>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={MAX_PER_DAY}>
          <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${(done / MAX_PER_DAY) * 100}%` }} transition={{ type: 'spring', stiffness: 80, damping: 18 }} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {SLOTS.map((s, i) => {
            const r = bySlot[s.value];
            const st = r && glucoseStatus(r.value);
            return (
              <motion.button
                key={s.value} type="button" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => (r ? open(r) : open(null, { date, slot: s.value }))}
                aria-label={r ? `Edit ${s.label} reading` : `Add ${s.label} reading`}
                className={cn('group cursor-pointer rounded-lg border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', !r && 'border-dashed bg-card/50')}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl" aria-hidden>{s.emoji}</span>
                  {r ? <Badge className={st.tone}>{st.label}</Badge> : <span className="grid size-6 place-items-center rounded-full bg-secondary text-primary transition group-hover:scale-110"><Plus className="size-3.5" /></span>}
                </div>
                <p className="mt-3 text-xs font-medium text-muted-foreground">{s.label}</p>
                {r ? (
                  <p className="font-display text-2xl font-bold tabular-nums">{r.value}<span className="ml-1 text-xs font-medium text-muted-foreground">mg/dl</span></p>
                ) : (
                  <p className="font-display text-lg font-semibold text-muted-foreground/70">Not logged</p>
                )}
              </motion.button>
            );
          })}
        </div>
        {done === MAX_PER_DAY && (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-success"><Check className="size-4" />All four readings logged today - nice work!</p>
        )}
      </section>

      {/* Month to date */}
      <section aria-labelledby="mtd-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="mtd-heading" className="text-lg font-semibold">This month so far</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/reports">All reports<ArrowRight /></Link></Button>
        </div>
        {month.loading && !month.data ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : month.error ? (
          <p role="alert" className="text-sm font-medium text-destructive">{month.error.message}</p>
        ) : (
          <ReportBody report={{ ...month.data, type: 'summary' }} onAdd={() => open()} />
        )}
        {month.data && !month.data.empty && (
          <Card>
            <CardHeader><CardTitle>Readings this month</CardTitle><CardDescription>Daily average with the 70–180 mg/dl reference band.</CardDescription></CardHeader>
            <CardContent><ReadingChart readings={month.data.readings} /></CardContent>
          </Card>
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

