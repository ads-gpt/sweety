import { reportRange } from '../lib/dates.js';
import { summarize } from '../lib/stats.js';
import { readingsBetween } from './readings.js';
import { cacheGet, cacheSet, reportKey } from '../lib/cache.js';

export async function buildReport(userId, type, date) {
  const key = reportKey(userId, type, date);
  const cached = await cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const { from, to } = reportRange(type, date);
  const readings = await readingsBetween(userId, from, to);
  const stats = summarize(readings.map((r) => r.value));

  const report = {
    type,
    selectedDate: date,
    from,
    to,
    empty: stats === null,
    stats, // { count, highest, lowest, average } or null when there are no readings
    readings,
  };
  await cacheSet(key, report);
  return { ...report, cached: false };
}
