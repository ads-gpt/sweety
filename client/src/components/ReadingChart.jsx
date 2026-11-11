import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TARGET, SLOTS, slotLabel } from '@/lib/glucose';
import { formatDate, parseISO } from '@/lib/dates';

/** Collapse readings into one point per day (daily average) while keeping each reading for the tooltip. */
function toSeries(readings) {
  const byDay = new Map();
  for (const r of readings) {
    const day = byDay.get(r.date) ?? { date: r.date, values: [], items: [] };
    day.values.push(r.value);
    day.items.push(r);
    byDay.set(r.date, day);
  }
  return [...byDay.values()].map((d) => ({
    date: d.date,
    avg: Math.round((d.values.reduce((a, b) => a + b, 0) / d.values.length) * 10) / 10,
    min: Math.min(...d.values),
    max: Math.max(...d.values),
    items: d.items,
  }));
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold">{formatDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      <p className="text-muted-foreground">Average <span className="font-semibold text-foreground">{p.avg}</span> mg/dl</p>
      <ul className="mt-1.5 space-y-0.5">
        {p.items.map((r) => (
          <li key={r.id} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{SLOTS.find((s) => s.value === r.slot)?.short ?? slotLabel(r.slot)}</span>
            <span className="font-semibold tabular-nums">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReadingChart({ readings, height = 280 }) {
  const data = toSeries(readings);
  const top = Math.max(220, ...data.map((d) => d.max + 20));
  const bottom = Math.min(50, ...data.map((d) => d.min - 10));

  return (
    <div style={{ height }} role="img" aria-label="Line chart of daily average glucose readings">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <ReferenceArea y1={TARGET.low} y2={TARGET.high} fill="var(--success)" fillOpacity={0.08} stroke="none" />
          <XAxis dataKey="date" tickFormatter={(d) => parseISO(d).getDate()} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} minTickGap={12} />
          <YAxis domain={[bottom, top]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--primary)', strokeOpacity: 0.25 }} />
          <Area type="monotone" dataKey="avg" stroke="none" fill="url(#avgFill)" isAnimationActive={false} />
          <Line type="monotone" dataKey="avg" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 2, fill: 'var(--card)' }} activeDot={{ r: 6 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
