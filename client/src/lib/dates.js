const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export const toISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "Today" follows the signed-in user's own timezone (set from their profile), not the device clock.
let userTimezone = null;
export const setTimezone = (tz) => { userTimezone = tz || null; };
// Browsers sometimes report a zone's old name (e.g. Chrome says Asia/Calcutta). Use the current IANA name.
const RENAMED_ZONES = {
  'Asia/Calcutta': 'Asia/Kolkata', 'Asia/Saigon': 'Asia/Ho_Chi_Minh', 'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon', 'Europe/Kiev': 'Europe/Kyiv', 'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Atlantic/Faeroe': 'Atlantic/Faroe', 'Pacific/Truk': 'Pacific/Chuuk',
};
export const canonicalTimezone = (tz) => RENAMED_ZONES[tz] ?? tz;
export const browserTimezone = () => canonicalTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
export const todayISO = (now = new Date(), tz = userTimezone) =>
  tz ? new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now) : toISO(now);

export const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const formatDate = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  parseISO(iso).toLocaleDateString('en-GB', opts);

/** "1 Oct – 15 Oct 2026" style range label. */
export function formatRange(from, to) {
  if (from === to) return formatDate(from);
  const a = parseISO(from);
  const b = parseISO(to);
  const day = { day: 'numeric', month: 'short' };
  const left = a.toLocaleDateString('en-GB', a.getFullYear() === b.getFullYear() ? day : { ...day, year: 'numeric' });
  return `${left} – ${formatDate(to)}`;
}
