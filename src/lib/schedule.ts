import { isWeekend } from './dates';
import { formatTime, formatTimeRange } from '@/lib/time-format';

// Pure schedule rules shared by the week, month, and list views.

export type ShiftLike = {
  id: string;
  crew_id: string;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
};

export type TimeOffLike = {
  crew_id: string;
  start_date: string;
  end_date: string;
  type: 'vacation' | 'sick' | 'personal' | 'other' | null;
  /** Part of a day off; both null (or missing) for whole days. */
  start_time?: string | null;
  end_time?: string | null;
};

export type HolidayLike = { holiday_date: string; name: string };

/** Timed shifts first by start, then untimed ones. */
export function sortShifts<T extends ShiftLike>(shifts: T[]) {
  return [...shifts].sort((a, b) => {
    if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
    if (a.start_time) return -1;
    if (b.start_time) return 1;
    return 0;
  });
}

export function timeOffOn<T extends TimeOffLike>(timeOff: T[], crewId: string, day: string) {
  return timeOff.find((t) => t.crew_id === crewId && t.start_date <= day && t.end_date >= day);
}

/**
 * Weekdays always show; Saturday and Sunday show only when a displayed crew
 * member has a shift or time off that day, or the office is closed.
 */
export function visibleWeekDays(
  days: string[],
  { shifts, timeOff, holidays }: { shifts: ShiftLike[]; timeOff: TimeOffLike[]; holidays: HolidayLike[] },
) {
  return days.filter(
    (d) =>
      !isWeekend(d) ||
      shifts.some((s) => s.shift_date === d) ||
      timeOff.some((t) => t.start_date <= d && t.end_date >= d) ||
      holidays.some((h) => h.holiday_date === d),
  );
}

export type Conflict = { kind: 'holiday'; label: string } | { kind: 'time-off'; label: string; sick: boolean };

/**
 * Whether time off overlaps a shift's hours, matching the database's
 * off_overlaps(). Whole days always do; a shift without times counts as the
 * whole day.
 */
export function offOverlapsShift(
  off: Pick<TimeOffLike, 'start_time' | 'end_time'>,
  shift: Pick<ShiftLike, 'start_time' | 'end_time'>,
) {
  if (!off.start_time || !off.end_time) return true;
  const offStart = off.start_time.slice(0, 5);
  const offEnd = off.end_time.slice(0, 5);
  return offStart < (shift.end_time?.slice(0, 5) ?? '24:00') && offEnd > (shift.start_time?.slice(0, 5) ?? '00:00');
}

/** Time off for this person and day that overlaps the shift's hours, if any. */
export function timeOffDuring<T extends TimeOffLike>(timeOff: T[], shift: ShiftLike) {
  return timeOff.find(
    (t) =>
      t.crew_id === shift.crew_id &&
      t.start_date <= shift.shift_date &&
      t.end_date >= shift.shift_date &&
      offOverlapsShift(t, shift),
  );
}

export function shiftConflicts(shift: ShiftLike, timeOff: TimeOffLike[], holidays: HolidayLike[]): Conflict[] {
  const out: Conflict[] = [];
  const holiday = holidays.find((h) => h.holiday_date === shift.shift_date);
  if (holiday) out.push({ kind: 'holiday', label: `${holiday.name}, office closed` });
  const off = timeOffDuring(timeOff, shift);
  if (off) {
    const when = off.start_time && off.end_time ? ` ${formatTimeRange(off.start_time, off.end_time)}` : ' this day';
    out.push({ kind: 'time-off', label: `${timeOffLabel(off.type)}${when}`, sick: off.type === 'sick' });
  }
  return out;
}

/** "Vacation", or "Personal day · 12:00 PM – 5:00 PM" for part of a day. */
export function timeOffText(off: Pick<TimeOffLike, 'type' | 'start_time' | 'end_time'>) {
  const label = timeOffLabel(off.type);
  return off.start_time && off.end_time ? `${label} · ${formatTimeRange(off.start_time, off.end_time)}` : label;
}

export function timeOffLabel(type: TimeOffLike['type']) {
  switch (type) {
    case 'vacation':
      return 'Vacation';
    case 'sick':
      return 'Sick';
    case 'personal':
      return 'Personal day';
    case 'other':
      return 'Off';
    default:
      return 'Off';
  }
}

export function shiftTimeLabel(shift: Pick<ShiftLike, 'start_time' | 'end_time'>) {
  const { start_time: s, end_time: e } = shift;
  if (s && e) return formatTimeRange(s, e);
  if (s) return `From ${formatTime(s)}`;
  if (e) return `Until ${formatTime(e)}`;
  return 'No set time';
}

/**
 * Reads what people type for a time: "9", "9:30", "930", "9am", "2:15 pm",
 * "14:00". Returns "HH:MM", null for blank, or undefined when unreadable.
 */
export function parseTime(input: string): string | null | undefined {
  const raw = input.trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  if (!raw) return null;
  if (raw === 'noon') return '12:00';
  const match = /^(\d{1,2})(?::?(\d{2}))?(a|am|p|pm)?$/.exec(raw);
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.[0];
  if (minute > 59) return undefined;
  if (meridiem) {
    if (hour < 1 || hour > 12) return undefined;
    if (meridiem === 'a' && hour === 12) hour = 0;
    if (meridiem === 'p' && hour !== 12) hour += 12;
  } else if (hour > 23) {
    return undefined;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** New order after moving one id up or down by one place. */
export function moveId(ids: string[], id: string, delta: -1 | 1) {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const clock = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/**
 * The error for an end that isn't after the start, with the likely fix when
 * AM and PM look swapped (9:00 PM – 12:00 PM was meant as 9:00 AM – 12:00 PM).
 */
export function endBeforeStartMessage(start: string, end: string) {
  const s = minutes(start);
  const e = minutes(end);
  if (s === e) return 'End must be after the start.';
  const fixes = [s >= 12 * 60 ? [s - 12 * 60, e] : null, e < 12 * 60 ? [s, e + 12 * 60] : null].filter(
    (f): f is number[] => !!f && f[1] > f[0] && f[1] - f[0] <= 14 * 60,
  );
  if (fixes.length !== 1) return 'End must be after the start.';
  const [fs, fe] = fixes[0];
  return `End must be after the start. Did you mean ${formatTimeRange(clock(fs), clock(fe))}?`;
}

/**
 * Times that are allowed but probably a typo, as short phrases ("starts at
 * 9:00 PM"). Empty when nothing looks off.
 */
export function unusualTimes(start: string | null, end: string | null) {
  const found: string[] = [];
  if (start && (start < '05:00' || start >= '21:00')) found.push(`starts at ${formatTime(start)}`);
  if (end && end > '22:00') found.push(`ends at ${formatTime(end)}`);
  if (start && end && end > start) {
    const length = minutes(end) - minutes(start);
    if (length > 12 * 60) found.push(`is ${Math.round(length / 6) / 10} hours long`);
    else if (length < 30) found.push(`is only ${length} minutes long`);
  }
  return found;
}

/** "This shift starts at 9:00 PM and is 13 hours long." */
export function unusualSentence(what: string, found: string[]) {
  const list = found.length > 1 ? `${found.slice(0, -1).join(', ')} and ${found.at(-1)}` : found[0];
  return `${what} ${list}. Save it anyway?`;
}
