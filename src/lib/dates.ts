// All calendar dates are handled as local "YYYY-MM-DD" strings, matching Postgres `date`.

export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function monthTitle(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = parseISODate(s);
  return `${DAY_SHORT[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

/** Whole days from today until `s` (negative if past). */
export function daysUntil(s: string): number {
  const ms = parseISODate(s).getTime() - parseISODate(todayISO()).getTime();
  return Math.round(ms / 86_400_000);
}

export function countdownLabel(s: string): string {
  const n = daysUntil(s);
  if (n < 0) return `Need-by date passed ${-n} day${n === -1 ? '' : 's'} ago`;
  if (n === 0) return 'Needed today — respond now';
  return `${n} day${n === 1 ? '' : 's'} left to respond`;
}

// ---------- times of day (24h "HH:MM" strings) ----------

/** Every 30 minutes from 12:00 AM to 11:30 PM. */
export const TIME_OPTIONS: string[] = Array.from(
  { length: 48 },
  (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`,
);

export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatWindow(w: { all_day: boolean; start?: string; end?: string } | undefined): string {
  if (!w) return 'Time not set';
  if (w.all_day || !w.start || !w.end) return 'All day';
  return formatRange(w.start, w.end);
}

/** The option after `t`, used to keep end times after start times. */
export function nextTime(t: string): string | null {
  const i = TIME_OPTIONS.indexOf(t);
  return i >= 0 && i < TIME_OPTIONS.length - 1 ? TIME_OPTIONS[i + 1] : null;
}

/** Compact "time ago": "now", "5m", "3h", "2d", or a date for older ones. */
export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatDate(toISODate(new Date(iso)));
}
