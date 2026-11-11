import { useState } from 'react';
import { Button, Skeleton, Status } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ReadingChart } from '@/components/ReadingChart';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { formatRange, todayISO } from '@/lib/dates';
import { glucoseStatus } from '@/lib/glucose';

export const REPORT_TABS = [
  { value: 'daily', label: 'Daily', blurb: 'The selected date' },
  { value: 'month-to-date', label: 'Month to date', blurb: '1st of the month up to the selected date' },
  { value: 'monthly', label: 'Previous month', blurb: 'The whole month before the selected date' },
];

/** One bordered band with four figures separated by hairlines - reads like a report, not a card grid. */
export function StatBand({ stats }) {
  const items = [
    { label: 'Highest', value: stats.highest, unit: 'mg/dl', color: 'var(--high)' },
    { label: 'Lowest', value: stats.lowest, unit: 'mg/dl', color: 'var(--low)' },
    { label: 'Average', value: stats.average.toFixed(1), unit: 'mg/dl' },
    { label: 'Readings', value: stats.count },
  ];
  return (
    <dl className="grid grid-cols-2 divide-x divide-y rounded-lg border bg-card lg:grid-cols-4 lg:divide-y-0">
      {items.map((it) => (
        <div key={it.label} className="px-5 py-4">
          <dt className="eyebrow flex items-center gap-1.5">
            {it.color && <span className="size-1.5 rounded-full" style={{ background: it.color }} aria-hidden />}
            {it.label}
          </dt>
          <dd className="num mt-2 text-[2.5rem] leading-none">
            {it.value}
            {it.unit && <span className="ml-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground">{it.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ title = 'No readings yet', text, action }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-12 sm:px-10">
      <h3 className="text-2xl">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ReportBody({ report, onAdd }) {
  if (report.empty) {
    return (
      <EmptyState
        title="Nothing to report yet"
        text={`There are no readings between ${formatRange(report.from, report.to)}. Once you log some, your highest, lowest and average will show up here.`}
        action={onAdd && <Button onClick={onAdd}>Add a reading</Button>}
      />
    );
  }
  return (
    <div className="space-y-6">
      <StatBand stats={report.stats} />

      {report.type !== 'daily' && report.readings.length > 1 && (
        <section className="rounded-lg border bg-card p-5">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h3 className="text-lg">Daily average</h3>
            <p className="text-xs text-muted-foreground">Shaded band: 70–180 mg/dl</p>
          </div>
          <ReadingChart readings={report.readings} />
        </section>
      )}

      {report.type === 'daily' && (
        <section>
          <h3 className="mb-2 text-lg">Readings</h3>
          <ul className="divide-y rounded-lg border bg-card">
            {report.readings.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.slotLabel}</p>
                  {r.notes && <p className="truncate text-xs text-muted-foreground">{r.notes}</p>}
                </div>
                <Status status={glucoseStatus(r.value)} className="hidden sm:inline-flex" />
                <p className="num w-24 text-right text-2xl">{r.value}<span className="ml-1 font-sans text-xs font-medium tracking-normal text-muted-foreground">mg/dl</span></p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Tabbed report browser. When `patientId` is set (doctor view) reports are fetched for that patient. */
export function ReportExplorer({ patientId, onAdd, initialDate }) {
  const [type, setType] = useState('daily');
  const [date, setDate] = useState(initialDate ?? todayISO());
  const { data, error, loading } = useAsync(() => api.report(type, { date, patientId }), [type, date, patientId]);
  const tab = REPORT_TABS.find((t) => t.value === type);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs value={type} onValueChange={setType}>
          <TabsList>
            {REPORT_TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <label className="flex items-center gap-2 text-[13px] font-medium">
          <span className="text-muted-foreground">Selected date</span>
          <input
            type="date" value={date} max={todayISO()} aria-label="Selected date"
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-2.5 text-sm focus-visible:border-foreground focus-visible:outline-none"
          />
        </label>
      </div>

      <p className="text-sm text-muted-foreground">
        {tab.blurb} · <span className="font-semibold text-foreground">{data ? formatRange(data.from, data.to) : '…'}</span>
      </p>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 px-4 py-3 text-sm font-medium text-destructive">{error.message}</p>
      ) : loading && !data ? (
        <Skeleton className="h-28" />
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}><ReportBody report={data} onAdd={onAdd} /></div>
      )}
    </div>
  );
}
