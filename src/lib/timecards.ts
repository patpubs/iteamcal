import { parseTime } from '@/lib/schedule';

/** The four times on a card as the database stores them ("HH:MM" or "HH:MM:SS"). */
export type CardTimes = {
  start_time: string;
  end_time: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
};

export type PunchState = 'none' | 'working' | 'lunch' | 'done';

/** Where today's card is in the day, which decides the punch buttons. */
export function punchState(card: CardTimes | null | undefined): PunchState {
  if (!card) return 'none';
  if (card.end_time) return 'done';
  if (card.lunch_start && !card.lunch_end) return 'lunch';
  return 'working';
}

function minutes(value: string) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Shift minus lunch in hours, rounded to two places like the database's
 * net_hours. Null while the shift is still open (PRD §9).
 */
export function netHours(card: CardTimes): number | null {
  if (!card.end_time) return null;
  const lunch = card.lunch_start && card.lunch_end ? minutes(card.lunch_end) - minutes(card.lunch_start) : 0;
  return Math.round(((minutes(card.end_time) - minutes(card.start_time) - lunch) / 60) * 100) / 100;
}

/** "7.50 hrs"; weekly totals only add finished cards. */
export function formatHours(hours: number) {
  return `${hours.toFixed(2)} ${hours === 1 ? 'hr' : 'hrs'}`;
}

export function totalHours(cards: { net_hours: number | null }[]) {
  return Math.round(cards.reduce((sum, c) => sum + (c.net_hours ?? 0), 0) * 100) / 100;
}

export type CardInput = { start: string; end: string; lunchStart: string; lunchEnd: string };
export type CardErrors = Partial<Record<keyof CardInput, string>>;

/**
 * Reads what was typed and applies the same rules as the database, so people
 * see a plain message before saving instead of a rejected save.
 */
export function readCard(input: CardInput): { values: CardTimes | null; errors: CardErrors } {
  const errors: CardErrors = {};
  const start = parseTime(input.start);
  const end = parseTime(input.end);
  const lunchStart = parseTime(input.lunchStart);
  const lunchEnd = parseTime(input.lunchEnd);

  if (start === null) errors.start = 'Add a start time.';
  if (start === undefined) errors.start = 'Try a time like 8:00a or 14:30.';
  if (end === undefined) errors.end = 'Try a time like 4:30p or 16:30.';
  if (lunchStart === undefined) errors.lunchStart = 'Try a time like 12:00p.';
  if (lunchEnd === undefined) errors.lunchEnd = 'Try a time like 12:30p.';

  if (start && end && end <= start) errors.end = 'End must be after the start.';
  if (lunchEnd && !lunchStart && lunchStart !== undefined) errors.lunchStart = 'Add when lunch started.';
  if (start && lunchStart && lunchStart < start) errors.lunchStart = 'Lunch can’t start before the shift.';
  if (lunchStart && lunchEnd && lunchEnd <= lunchStart) errors.lunchEnd = 'Lunch must end after it starts.';
  if (end && lunchStart && lunchEnd === null) errors.lunchEnd = 'Add when lunch ended, or clear the lunch start.';
  if (end && lunchEnd && lunchEnd > end && !errors.lunchEnd) errors.lunchEnd = 'Lunch must end before the shift ends.';

  if (Object.keys(errors).length || !start) return { values: null, errors };
  return {
    values: { start_time: start, end_time: end ?? null, lunch_start: lunchStart ?? null, lunch_end: lunchEnd ?? null },
    errors,
  };
}
