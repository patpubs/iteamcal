import { isWeekend } from './dates';

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

export function shiftConflicts(shift: ShiftLike, timeOff: TimeOffLike[], holidays: HolidayLike[]): Conflict[] {
  const out: Conflict[] = [];
  const holiday = holidays.find((h) => h.holiday_date === shift.shift_date);
  if (holiday) out.push({ kind: 'holiday', label: `${holiday.name}, office closed` });
  const off = timeOffOn(timeOff, shift.crew_id, shift.shift_date);
  if (off) out.push({ kind: 'time-off', label: `${timeOffLabel(off.type)} this day`, sick: off.type === 'sick' });
  return out;
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

/** "09:00:00" → "9:00a", "13:30" → "1:30p". */
export function shortTime(value: string) {
  const [h, m] = value.split(':').map(Number);
  const suffix = h < 12 ? 'a' : 'p';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''}${suffix}`;
}

export function shiftTimeLabel(shift: Pick<ShiftLike, 'start_time' | 'end_time'>) {
  const { start_time: s, end_time: e } = shift;
  if (s && e) return `${shortTime(s)}–${shortTime(e)}`;
  if (s) return `From ${shortTime(s)}`;
  if (e) return `Until ${shortTime(e)}`;
  return 'No set time';
}

/**
 * Reads what people type for a time: "9", "9:30", "930", "9am", "2:15 pm",
 * "14:00". Returns "HH:MM", null for blank, or undefined when unreadable.
 */
export function parseTime(input: string): string | null | undefined {
  const raw = input.trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  if (!raw) return null;
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
