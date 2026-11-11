import { useState } from 'react';
import { ArrowDown, ArrowUp, Activity, Hash, CalendarRange, Droplet } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Skeleton, Button } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ReadingChart } from '@/components/ReadingChart';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { formatRange, todayISO } from '@/lib/dates';
import { glucoseStatus, SLOTS } from '@/lib/glucose';

export const REPORT_TABS = [
  { value: 'daily', label: 'Daily', blurb: 'The selected date' },
  { value: 'month-to-date', label: 'Month to date', blurb: '1st of the month up to the selected date' },
  { value: 'monthly', label: 'Previous month', blurb: 'The whole month before the selected date' },
];

function StatTile({ icon: Icon, label, value, unit, tone, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }}>
      <Card className="h-full">
        <CardContent className="p-5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
            <span className={`grid size-8 place-items-center rounded-lg ${tone}`}><Icon className="size-4" /></span>
          </div>
          <p className="mt-3 font-display text-3xl font-bold tabular-nums">
            {value}
            {unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function EmptyState({ title = 'No readings yet', text, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary"><Droplet className="size-7" /></div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function ReportBody({ report, onAdd }) {
  if (report.empty) {
    return (
      <EmptyState
        title="Nothing to report yet"
        text={`There are no readings between ${formatRange(report.from, report.to)}. Once you log some, your highest, lowest and average will show up here.`}
        action={onAdd && <Button variant="brand" onClick={onAdd}>Add a reading</Button>}
      />
    );
  }
  const { stats } = report;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={ArrowUp} label="Highest" value={stats.highest} unit="mg/dl" tone="bg-destructive/10 text-destructive" delay={0} />
        <StatTile icon={ArrowDown} label="Lowest" value={stats.lowest} unit="mg/dl" tone="bg-low/12 text-low" delay={0.05} />
        <StatTile icon={Activity} label="Average" value={stats.average.toFixed(1)} unit="mg/dl" tone="bg-primary/10 text-primary" delay={0.1} />
        <StatTile icon={Hash} label="Readings" value={stats.count} tone="bg-success/12 text-success" delay={0.15} />
      </div>

      {report.type !== 'daily' && report.readings.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily average trend</CardTitle>
            <CardDescription>Green band is the 70–180 mg/dl reference range.</CardDescription>
          </CardHeader>
          <CardContent><ReadingChart readings={report.readings} /></CardContent>
        </Card>
      )}

      {report.type === 'daily' && (
        <Card>
          <CardHeader><CardTitle>Readings</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {report.readings.map((r) => {
              const s = glucoseStatus(r.value);
              const slot = SLOTS.find((x) => x.value === r.slot);
              return (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl" aria-hidden>{slot?.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{r.slotLabel}</p>
                      {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={s.tone}>{s.label}</Badge>
                    <span className="w-20 text-right font-display text-lg font-bold tabular-nums">{r.value}<span className="ml-1 text-xs font-medium text-muted-foreground">mg/dl</span></span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Tabbed report browser. When `patientId` is set (doctor view) reports are fetched for that patient.
 */
export function ReportExplorer({ patientId, onAdd, initialDate }) {
  const [type, setType] = useState('daily');
  const [date, setDate] = useState(initialDate ?? todayISO());
  const { data, error, loading } = useAsync(() => api.report(type, { date, patientId }), [type, date, patientId]);
  const tab = REPORT_TABS.find((t) => t.value === type);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={type} onValueChange={setType}>
          <TabsList className="w-full sm:w-auto">
            {REPORT_TABS.map((t) => <TabsTrigger key={t.value} value={t.value} className="flex-1 sm:flex-none">{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <label className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">Selected date</span>
          <input
            type="date" value={date} max={todayISO()} aria-label="Selected date"
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-10 rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:border-primary focus-visible:outline-none"
          />
        </label>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarRange className="size-4" />
        <span>{tab.blurb}:</span>
        <span className="font-semibold text-foreground">{data ? formatRange(data.from, data.to) : '…'}</span>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error.message}</p>
      ) : loading && !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}><ReportBody report={data} onAdd={onAdd} /></div>
      )}
    </div>
  );
}
