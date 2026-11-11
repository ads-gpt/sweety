const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n) => String(n).padStart(2, '0');
const fmt = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** True only for real calendar dates in YYYY-MM-DD form (rejects 2026-02-31). */
export function isValidDate(s) {
  const m = ISO.exec(s ?? '');
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isValidTimezone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's date (YYYY-MM-DD) in the given IANA timezone. */
export function today(tz = 'UTC', now = new Date()) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export const isFuture = (date, ref = today()) => date > ref;

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

const parts = (s) => ISO.exec(s).slice(1).map(Number);

export function lastDayOfMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Report date ranges relative to a selected date.
 *  daily          -> the selected date
 *  month-to-date  -> 1st of that month .. selected date
 *  monthly        -> the whole previous calendar month
 */
export function reportRange(type, date) {
  const [y, m, d] = parts(date);
  switch (type) {
    case 'daily':
      return { from: date, to: date };
    case 'month-to-date':
      return { from: fmt(y, m, 1), to: fmt(y, m, d) };
    case 'monthly': {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { from: fmt(py, pm, 1), to: fmt(py, pm, lastDayOfMonth(py, pm)) };
    }
    default:
      throw new Error(`Unknown report type: ${type}`);
  }
}

export const REPORT_TYPES = ['daily', 'month-to-date', 'monthly'];
