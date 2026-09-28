import { useSyncExternalStore } from 'react';

/** full = "9:00 AM", short = "9a", 24h = "09:00". Each person picks theirs in More → Settings. */
export type TimeFormat = 'full' | 'short' | '24h';

export const TIME_FORMATS: { value: TimeFormat; label: string }[] = [
  { value: 'full', label: '9:00 AM' },
  { value: 'short', label: '9a' },
  { value: '24h', label: '09:00' },
];

let current: TimeFormat = 'full';
const listeners = new Set<() => void>();

export function getTimeFormat() {
  return current;
}

export function setTimeFormat(format: TimeFormat) {
  if (format === current) return;
  current = format;
  listeners.forEach((l) => l());
}

/** Re-renders the caller when the person changes their time format. */
export function useTimeFormat() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getTimeFormat,
    getTimeFormat,
  );
}

/** "09:00:00" → "9:00 AM", "9a", or "09:00". */
export function formatTime(value: string, format: TimeFormat = current) {
  const [h, m] = value.split(':').map(Number);
  const mm = String(m).padStart(2, '0');
  if (format === '24h') return `${String(h).padStart(2, '0')}:${mm}`;
  const hour = h % 12 === 0 ? 12 : h % 12;
  if (format === 'short') return `${hour}${m ? `:${mm}` : ''}${h < 12 ? 'a' : 'p'}`;
  return `${hour}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "9:00 AM – 5:00 PM", or "9a–5p" in the short style. */
export function formatTimeRange(start: string, end: string, format: TimeFormat = current) {
  const dash = format === 'short' ? '–' : ' – ';
  return `${formatTime(start, format)}${dash}${formatTime(end, format)}`;
}
