import { addDays, daysBetween, shortDay } from './dates';
import { endBeforeStartMessage, parseTime } from './schedule';
import { formatTimeRange } from './time-format';

// Pure rules for time-off ranges, the range picker, and coverage warnings.

export type Range = { start_date: string; end_date: string };

export function overlaps(a: Range, b: Range) {
  return a.start_date <= b.end_date && b.start_date <= a.end_date;
}

/** Calendar days in an inclusive range; weekends and holidays count (PRD §7). */
export function dayCount(r: Range) {
  return daysBetween(r.start_date, r.end_date) + 1;
}

export function rangeDays(r: Range) {
  return Array.from({ length: dayCount(r) }, (_, i) => addDays(r.start_date, i));
}

/** Hours for part of a day off; both null for whole days. */
export type Hours = { start_time?: string | null; end_time?: string | null };

/** "Oct 5", "Oct 5 · 12:00 PM – 5:00 PM", or "Oct 5 – Oct 7 · 3 days". */
export function rangeText(r: Range & Hours) {
  if (r.start_date === r.end_date) {
    return r.start_time && r.end_time
      ? `${shortDay(r.start_date)} · ${formatTimeRange(r.start_time, r.end_time)}`
      : shortDay(r.start_date);
  }
  return `${shortDay(r.start_date)} – ${shortDay(r.end_date)} · ${dayCount(r)} days`;
}

export type HoursErrors = { from?: string; until?: string };

/**
 * Reads typed from/until times for part of a day off, with the database's
 * rule that until is after from.
 */
export function readHours(
  from: string,
  until: string,
): {
  values: { start_time: string; end_time: string } | null;
  errors: HoursErrors;
} {
  const errors: HoursErrors = {};
  const start = parseTime(from);
  const end = parseTime(until);
  if (start === null) errors.from = 'Enter when time off starts.';
  else if (start === undefined) errors.from = 'Use a time like 12:00 PM.';
  if (end === null) errors.until = 'Enter when time off ends.';
  else if (end === undefined) errors.until = 'Use a time like 5:00 PM.';
  if (start && end && end <= start) errors.until = endBeforeStartMessage(start, end);
  if (errors.from || errors.until || !start || !end) return { values: null, errors };
  return { values: { start_time: start, end_time: end }, errors };
}

/**
 * Picking a range by tapping days: the first tap starts it, a later day ends
 * it, an earlier day restarts it, and tapping after a full range starts over.
 */
export function pickRange(current: { start: string | null; end: string | null }, day: string) {
  const { start, end } = current;
  if (!start || end) return { start: day, end: null };
  if (day < start) return { start: day, end: null };
  return { start, end: day };
}

export type Coverage = { crew_id: string; kind: 'off' | 'pending' };

/**
 * Other people already off, or also asking, during a request's dates. Only
 * informational: it never blocks a decision (PRD §8).
 */
export function coverageFor(
  request: Range & { id: string; crew_id: string },
  timeOff: (Range & { crew_id: string })[],
  pending: (Range & { id: string; crew_id: string })[],
): Coverage[] {
  const out = new Map<string, Coverage>();
  for (const t of timeOff) {
    if (t.crew_id !== request.crew_id && overlaps(t, request)) out.set(t.crew_id, { crew_id: t.crew_id, kind: 'off' });
  }
  for (const p of pending) {
    if (p.id !== request.id && p.crew_id !== request.crew_id && overlaps(p, request) && !out.has(p.crew_id)) {
      out.set(p.crew_id, { crew_id: p.crew_id, kind: 'pending' });
    }
  }
  return [...out.values()];
}
