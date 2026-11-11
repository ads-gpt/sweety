import { reportRange } from '../lib/dates.js';
import { summarize } from '../lib/stats.js';
import { targetsOf, timeInRange, estimatedA1c, statusOf } from '../lib/targets.js';
import { readingsBetween } from './readings.js';
import { commentsBetween } from './comments.js';
import { cacheGet, cacheSet, reportKey } from '../lib/cache.js';

/**
 * Build a report for `subject` (a users row). Targets come from the subject, so
 * a doctor sees a patient's report judged against that patient's own ranges.
 */
export async function buildReport(subject, type, date) {
  const key = reportKey(subject.id, type, date);
  const cached = await cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const { from, to } = reportRange(type, date);
  const targets = targetsOf(subject);
  const rows = await readingsBetween(subject.id, from, to);
  const readings = rows.map((r) => ({ ...r, status: statusOf(r.value, r.slot, targets) }));
  const stats = summarize(readings.map((r) => r.value));

  const report = {
    type,
    selectedDate: date,
    from,
    to,
    empty: stats === null,
    stats, // { count, highest, lowest, average } or null when there are no readings
    timeInRange: timeInRange(readings, targets), // { inRange, low, high, counts } or null
    estimatedA1c: stats ? estimatedA1c(stats.average, stats.count) : null, // null until 10+ readings
    targets,
    readings,
    comments: await commentsBetween(subject.id, from, to),
  };
  await cacheSet(key, report);
  return { ...report, cached: false };
}
