const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export const toISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());

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
