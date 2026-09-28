import { expect, test } from '@jest/globals';

import { formatTime, formatTimeRange, getTimeFormat, setTimeFormat } from './time-format';

test('full is the default, with minutes and AM/PM', () => {
  expect(getTimeFormat()).toBe('full');
  expect(formatTime('09:00:00')).toBe('9:00 AM');
  expect(formatTime('00:30')).toBe('12:30 AM');
  expect(formatTime('12:00')).toBe('12:00 PM');
  expect(formatTimeRange('09:00:00', '17:00:00')).toBe('9:00 AM – 5:00 PM');
});

test('short and 24-hour styles', () => {
  expect(formatTime('09:00', 'short')).toBe('9a');
  expect(formatTime('16:30', 'short')).toBe('4:30p');
  expect(formatTimeRange('08:00', '16:30', 'short')).toBe('8a–4:30p');
  expect(formatTime('09:05', '24h')).toBe('09:05');
  expect(formatTimeRange('08:00', '16:30', '24h')).toBe('08:00 – 16:30');
});

test('changing the setting changes the default', () => {
  setTimeFormat('24h');
  expect(formatTime('13:15')).toBe('13:15');
  setTimeFormat('full');
});
