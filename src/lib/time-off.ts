import { addDays, daysBetween, shortDay } from './dates';

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

/** "Oct 5", or "Oct 5 – Oct 7 · 3 days". */
export function rangeText(r: Range) {
  if (r.start_date === r.end_date) return shortDay(r.start_date);
  return `${shortDay(r.start_date)} – ${shortDay(r.end_date)} · ${dayCount(r)} days`;
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
