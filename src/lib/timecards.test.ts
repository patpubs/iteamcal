import { expect, test } from '@jest/globals';

import { formatHours, netHours, punchState, readCard, totalHours } from './timecards';

const card = (
  start_time: string,
  end_time: string | null,
  lunch_start: string | null = null,
  lunch_end: string | null = null,
) => ({
  start_time,
  end_time,
  lunch_start,
  lunch_end,
});

test('punch state follows the day', () => {
  expect(punchState(null)).toBe('none');
  expect(punchState(card('09:00:00', null))).toBe('working');
  expect(punchState(card('09:00:00', null, '12:00:00'))).toBe('lunch');
  expect(punchState(card('09:00:00', null, '12:00:00', '12:30:00'))).toBe('working');
  expect(punchState(card('09:00:00', '17:00:00'))).toBe('done');
});

test('net hours subtract lunch and round like the database', () => {
  expect(netHours(card('08:00', '16:30', '12:00', '12:30'))).toBe(8);
  expect(netHours(card('09:17:00', '12:30:00', '12:15:00', '12:20:00'))).toBe(3.13);
  expect(netHours(card('09:00', null))).toBeNull();
});

test('totals only count finished cards', () => {
  expect(totalHours([{ net_hours: 7.5 }, { net_hours: null }, { net_hours: 0.25 }])).toBe(7.75);
  expect(formatHours(7.75)).toBe('7.75 hrs');
  expect(formatHours(1)).toBe('1.00 hr');
});

test('reading a card applies the database rules', () => {
  expect(readCard({ start: '9a', end: '5:30p', lunchStart: '12p', lunchEnd: '12:30p' }).values).toEqual({
    start_time: '09:00',
    end_time: '17:30',
    lunch_start: '12:00',
    lunch_end: '12:30',
  });
  expect(readCard({ start: '9a', end: '', lunchStart: '12p', lunchEnd: '' }).values).not.toBeNull();
  expect(readCard({ start: '', end: '', lunchStart: '', lunchEnd: '' }).errors.start).toBeTruthy();
  expect(readCard({ start: '9a', end: '8a', lunchStart: '', lunchEnd: '' }).errors.end).toBeTruthy();
  expect(readCard({ start: '9a', end: '5p', lunchStart: '12p', lunchEnd: '' }).errors.lunchEnd).toBeTruthy();
  expect(readCard({ start: '9a', end: '5p', lunchStart: '', lunchEnd: '1p' }).errors.lunchStart).toBeTruthy();
  expect(readCard({ start: '9a', end: '5p', lunchStart: '8a', lunchEnd: '9:30a' }).errors.lunchStart).toBeTruthy();
  expect(readCard({ start: '9a', end: '1p', lunchStart: '12p', lunchEnd: '1:30p' }).errors.lunchEnd).toBeTruthy();
  expect(readCard({ start: '9a', end: '', lunchStart: '12p', lunchEnd: '11a' }).errors.lunchEnd).toBeTruthy();
});
