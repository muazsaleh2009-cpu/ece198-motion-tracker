// Calendar-date helpers. Dates are handled as local "YYYY-MM-DD" strings so that time zones
// never shift a session onto the wrong day.

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']; // index = (getDay()+6)%7

export function parseISO(str) {
  const [y, m, d] = String(str).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const isISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && toISO(parseISO(s)) === s;

export const todayISO = () => toISO(new Date());

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

export const weekdayIndex = (iso) => (parseISO(iso).getDay() + 6) % 7; // Monday = 0

export const weekStart = (iso) => addDays(iso, -weekdayIndex(iso));

/** The local calendar date of an ISO timestamp that carries its own offset, e.g. 2026-11-14T17:39:00-05:00. */
export const dateOfTimestamp = (ts) => String(ts).slice(0, 10);
export const timeOfTimestamp = (ts) => String(ts).slice(11, 16);

export function formatShort(iso) {
  return parseISO(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatLong(iso) {
  return parseISO(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDuration(seconds) {
  if (seconds == null) return '–';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}
