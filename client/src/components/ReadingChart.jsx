import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DEFAULT_TARGETS, slotLabel } from '@/lib/glucose';
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
    <div className="min-w-44 rounded-md border bg-card px-3 py-2.5 text-xs shadow-lg">
      <p className="eyebrow mb-1.5">{formatDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      <ul className="space-y-1">
        {p.items.map((r) => (
          <li key={r.id} className="flex justify-between gap-6">
            <span className="text-muted-foreground">{slotLabel(r.slot)}</span>
            <span className="font-semibold">{r.value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between border-t pt-1.5 text-muted-foreground">Average <span className="font-semibold text-foreground">{p.avg}</span></p>
    </div>
  );
}

export function ReadingChart({ readings, targets = DEFAULT_TARGETS, height = 260 }) {
  const low = targets.postLow;
  const high = targets.postHigh;
  const data = toSeries(readings);
  const top = Math.max(200, ...data.map((d) => d.max + 15));
  const bottom = Math.min(50, ...data.map((d) => d.min - 10));
  const tick = { fontSize: 11, fill: 'var(--muted-foreground)' };

  return (
    <div style={{ height }} role="img" aria-label="Line chart of daily average glucose readings">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <ReferenceArea y1={low} y2={high} fill="var(--success)" fillOpacity={0.09} stroke="none" />
          <ReferenceLine y={high} stroke="var(--success)" strokeOpacity={0.5} strokeDasharray="2 4" />
          <ReferenceLine y={low} stroke="var(--success)" strokeOpacity={0.5} strokeDasharray="2 4" />
          <XAxis dataKey="date" tickFormatter={(d) => parseISO(d).getDate()} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={tick} minTickGap={14} />
          <YAxis domain={[bottom, top]} tickLine={false} axisLine={false} tick={tick} ticks={[low, 100, 140, high, 220].filter((t) => t >= bottom && t <= top)} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--foreground)', strokeOpacity: 0.2 }} />
          <Line type="linear" dataKey="avg" stroke="var(--foreground)" strokeWidth={1.5} dot={{ r: 2.5, fill: 'var(--foreground)', strokeWidth: 0 }} activeDot={{ r: 4.5, fill: 'var(--foreground)', strokeWidth: 0 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
