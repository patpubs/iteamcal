// Calendar-day helpers. Days are 'YYYY-MM-DD' strings. Arithmetic runs on UTC
// midnights so time zones and daylight saving can never shift a day.

export const TEAM_TIME_ZONE = 'America/Chicago';

const DAY_MS = 86_400_000;

function toUtc(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

/** Today's date in the team's time zone. */
export function today(now = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TEAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(day: string, n: number) {
  return fromUtc(toUtc(day) + n * DAY_MS);
}

export function daysBetween(from: string, to: string) {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: string) {
  return (new Date(toUtc(day)).getUTCDay() + 6) % 7;
}

export function isWeekend(day: string) {
  return weekdayIndex(day) >= 5;
}

/** Monday of the week containing `day`. */
export function weekStart(day: string) {
  return addDays(day, -weekdayIndex(day));
}

export function weekDays(day: string) {
  const start = weekStart(day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function monthStart(day: string) {
  return `${day.slice(0, 8)}01`;
}

export function addMonths(day: string, n: number) {
  const [y, m] = day.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  return fromUtc(first.getTime());
}

/** Full Monday-start weeks covering the month of `day`. */
export function monthGrid(day: string) {
  const first = monthStart(day);
  const last = addDays(addMonths(first, 1), -1);
  const start = weekStart(first);
  const end = addDays(weekStart(last), 6);
  const weeks: string[][] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) weeks.push(weekDays(d));
  return weeks;
}

export function sameMonth(a: string, b: string) {
  return a.slice(0, 7) === b.slice(0, 7);
}

function fmt(day: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(new Date(toUtc(day)));
}

/** "Mon" */
export const shortWeekday = (day: string) => fmt(day, { weekday: 'short' });
/** "Monday, September 28" */
export const longDay = (day: string) => fmt(day, { weekday: 'long', month: 'long', day: 'numeric' });
/** "September 2026" */
export const monthLabel = (day: string) => fmt(day, { month: 'long', year: 'numeric' });
/** "Sep 28" */
export const shortDay = (day: string) => fmt(day, { month: 'short', day: 'numeric' });
export const dayOfMonth = (day: string) => Number(day.slice(8, 10));

/** "Sep 28 – Oct 4, 2026" */
export function rangeLabel(from: string, to: string) {
  const year = to.slice(0, 4);
  const sameYear = from.slice(0, 4) === year;
  return `${fmt(from, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })} – ${fmt(to, {
    month: 'short',
    day: 'numeric',
  })}, ${year}`;
}

/** "Just now", "5 min ago", "3 hr ago", "Yesterday", then "Sep 21", in team time. */
export function timeAgo(iso: string, now = new Date()) {
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const day = today(new Date(iso));
  const todayNow = today(now);
  if (day === todayNow) return `${Math.floor(minutes / 60)} hr ago`;
  if (day === addDays(todayNow, -1)) return 'Yesterday';
  return shortDay(day);
}
