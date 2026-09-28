/** Minutes since midnight for an "HH:MM" or "HH:MM:SS" time. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Net hours for a timecard: shift length minus lunch, rounded to two decimals.
 * Matches the database's net_hours column. Returns null while the shift is open.
 */
export function netHours(card: {
  start_time: string;
  end_time: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
}): number | null {
  if (!card.end_time) return null;
  const worked = toMinutes(card.end_time) - toMinutes(card.start_time);
  const lunch = card.lunch_start && card.lunch_end ? toMinutes(card.lunch_end) - toMinutes(card.lunch_start) : 0;
  return Math.round(((worked - lunch) / 60) * 100) / 100;
}

/** Weekly total counts only finished cards (PRD §9). */
export function weeklyTotal(cards: { net_hours: number | null }[]): number {
  const total = cards.reduce((sum, c) => sum + (c.net_hours ?? 0), 0);
  return Math.round(total * 100) / 100;
}
