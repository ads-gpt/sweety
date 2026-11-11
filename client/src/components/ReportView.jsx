import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button, Skeleton, Status } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { ReadingChart } from '@/components/ReadingChart';
import { TagList } from '@/components/Tags';
import { api } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { formatDate, formatRange, todayISO } from '@/lib/dates';
import { statusMeta } from '@/lib/glucose';

export const REPORT_TABS = [
  { value: 'daily', label: 'Daily', blurb: 'The selected date' },
  { value: 'month-to-date', label: 'Month to date', blurb: '1st of the month up to the selected date' },
  { value: 'monthly', label: 'Previous month', blurb: 'The whole month before the selected date' },
];

/** One bordered band with the key figures separated by hairlines - reads like a report, not a card grid. */
export function StatBand({ stats, a1c }) {
  const items = [
    { label: 'Highest', value: stats.highest, unit: 'mg/dl', color: 'var(--high)' },
    { label: 'Lowest', value: stats.lowest, unit: 'mg/dl', color: 'var(--low)' },
    { label: 'Average', value: stats.average.toFixed(1), unit: 'mg/dl' },
    { label: 'Readings', value: stats.count },
  ];
  return (
    <dl className="grid grid-cols-2 divide-x divide-y rounded-lg border bg-card lg:grid-cols-4 lg:divide-y-0">
      {items.map((it) => (
        <div key={it.label} className="px-6 py-6">
          <dt className="eyebrow flex items-center gap-1.5">
            {it.color && <span className="size-1.5 rounded-full" style={{ background: it.color }} aria-hidden />}
            {it.label}
          </dt>
          <dd className="num mt-3 text-[2.75rem]">
            {it.value}
            {it.unit && <span className="ml-1.5 font-sans text-xs font-medium tracking-normal text-muted-foreground">{it.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Share of readings below / in / above the user's own target ranges, plus the estimated A1c. */
export function RangeSummary({ tir, a1c, targets, count }) {
  if (!tir) return null;
  const segs = [
    { key: 'low', label: 'Below range', pct: tir.low, color: 'var(--low)' },
    { key: 'ok', label: 'In range', pct: tir.inRange, color: 'var(--success)' },
    { key: 'high', label: 'Above range', pct: tir.high, color: 'var(--high)' },
  ];
  return (
    <section className="rounded-lg border bg-card p-6" aria-label="Time in range">
      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="eyebrow">Time in range</p>
          <p className="num mt-3 text-[2.75rem]">{tir.inRange}<span className="ml-0.5 font-sans text-lg font-medium tracking-normal text-muted-foreground">%</span></p>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-border" role="img" aria-label={`${tir.low}% below range, ${tir.inRange}% in range, ${tir.high}% above range`}>
            {segs.map((s) => s.pct > 0 && <span key={s.key} style={{ width: `${s.pct}%`, background: s.color }} />)}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {segs.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full" style={{ background: s.color }} aria-hidden />{s.label} <span className="font-semibold text-foreground">{s.pct}%</span>
              </li>
            ))}
          </ul>
          {targets && (
            <p className="mt-3 text-xs text-muted-foreground">
              Targets: fasting {targets.fastingLow}–{targets.fastingHigh}, after meals {targets.postLow}–{targets.postHigh} mg/dl.
            </p>
          )}
        </div>
        <div className="md:min-w-44 md:border-l md:pl-8">
          <p className="eyebrow">Estimated HbA1c</p>
          {a1c != null ? (
            <p className="num mt-3 text-[2.75rem]">{a1c.toFixed(1)}<span className="ml-0.5 font-sans text-lg font-medium tracking-normal text-muted-foreground">%</span></p>
          ) : (
            <p className="mt-3 max-w-44 text-sm text-muted-foreground">Needs at least 10 readings in the period ({count} so far).</p>
          )}
          <p className="mt-2 max-w-44 text-xs text-muted-foreground">An estimate from your average, not a lab result.</p>
        </div>
      </div>
    </section>
  );
}

export function CommentList({ comments, onDelete, title = 'Notes from your doctor' }) {
  if (!comments?.length) return null;
  return (
    <section aria-label={title}>
      <h3 className="mb-3 text-xl">{title}</h3>
      <ul className="divide-y rounded-lg border bg-card">
        {comments.map((c) => (
          <li key={c.id} className="px-6 py-4">
            <p className="text-sm">{c.body}</p>
            <p className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{c.doctor.name} · on {formatDate(c.date)}</span>
              {onDelete && <button type="button" onClick={() => onDelete(c)} className="cursor-pointer font-medium text-destructive underline underline-offset-4 hover:opacity-70">Delete</button>}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EmptyState({ title = 'No readings yet', text, action }) {
  return (
    <div className="rounded-lg border border-dashed px-8 py-14 sm:px-12">
      <h3 className="text-2xl">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ReportBody({ report, onAdd, onDeleteComment, showComments = true }) {
  if (report.empty) {
    return (
      <div className="space-y-8">
        <EmptyState
          title="Nothing to report yet"
          text={`There are no readings between ${formatRange(report.from, report.to)}. Once you log some, your highest, lowest and average will show up here.`}
          action={onAdd && <Button onClick={onAdd}>Add a reading</Button>}
        />
        {showComments && <CommentList comments={report.comments} onDelete={onDeleteComment} />}
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <StatBand stats={report.stats} />
      <RangeSummary tir={report.timeInRange} a1c={report.estimatedA1c} targets={report.targets} count={report.stats.count} />

      {report.type !== 'daily' && report.readings.length > 1 && (
        <section className="rounded-lg border bg-card p-6 print:break-inside-avoid">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h3 className="text-xl">Daily average</h3>
            <p className="text-xs text-muted-foreground">Shaded band: after-meal target {report.targets.postLow}–{report.targets.postHigh} mg/dl</p>
          </div>
          <ReadingChart readings={report.readings} targets={report.targets} />
        </section>
      )}

      {report.type === 'daily' && (
        <section>
          <h3 className="mb-3 text-xl">Readings</h3>
          <ul className="divide-y rounded-lg border bg-card">
            {report.readings.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.slotLabel}</p>
                  {(r.notes || r.tags?.length > 0) && (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <TagList tags={r.tags} />{r.notes && <span className="truncate">{r.notes}</span>}
                    </p>
                  )}
                </div>
                <Status status={statusMeta(r.status)} className="hidden sm:inline-flex" />
                <p className="num w-24 text-right text-2xl">{r.value}<span className="ml-1 font-sans text-xs font-medium tracking-normal text-muted-foreground">mg/dl</span></p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showComments && <CommentList comments={report.comments} onDelete={onDeleteComment} />}
    </div>
  );
}

/**
 * Tabbed report browser. When `patientId` is set (doctor view) reports are fetched for that patient.
 * `reloadKey` lets a parent force a refetch (e.g. after a doctor adds a comment).
 */
export function ReportExplorer({ patientId, patientName, onAdd, initialDate, reloadKey, onDeleteComment, extra }) {
  const [type, setType] = useState('daily');
  const [date, setDate] = useState(initialDate ?? todayISO());
  const { data, error, loading } = useAsync(() => api.report(type, { date, patientId }), [type, date, patientId, reloadKey]);
  const tab = REPORT_TABS.find((t) => t.value === type);

  return (
    <div className="space-y-8">
      {/* Shown only when printing / saving as PDF */}
      <div className="hidden print:block">
        <p className="eyebrow">Sweety glucose report</p>
        <h2 className="mt-1 text-3xl">{patientName ?? 'My readings'}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tab.label}: {data ? formatRange(data.from, data.to) : ''} · generated {formatDate(todayISO())}
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <Tabs value={type} onValueChange={setType}>
          <TabsList>
            {REPORT_TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] font-medium">
            <span className="text-muted-foreground">Selected date</span>
            <input
              type="date" value={date} max={todayISO()} aria-label="Selected date"
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-card px-2.5 text-sm focus-visible:border-foreground focus-visible:outline-none"
            />
          </label>
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!data || !!error}><Printer />Print / PDF</Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground print:hidden">
        {tab.blurb} · <span className="font-semibold text-foreground">{data ? formatRange(data.from, data.to) : '…'}</span>
      </p>

      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 px-4 py-3 text-sm font-medium text-destructive">{error.message}</p>
      ) : loading && !data ? (
        <Skeleton className="h-28" />
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <ReportBody report={data} onAdd={onAdd} onDeleteComment={onDeleteComment} />
        </div>
      )}
      {extra}
    </div>
  );
}
