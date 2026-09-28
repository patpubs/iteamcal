import { describe, expect, it } from '@jest/globals';

import {
  addDays,
  addMonths,
  isDay,
  monthGrid,
  rangeLabel,
  today,
  weekDays,
  weekStart,
  weekdayIndex,
  timeAgo,
} from './dates';

describe('dates', () => {
  it('adds days across month, year, and daylight-saving changes', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });

  it('starts weeks on Monday', () => {
    expect(weekdayIndex('2026-09-28')).toBe(0);
    expect(weekStart('2026-10-04')).toBe('2026-09-28');
    expect(weekDays('2026-09-30')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('builds a full month grid', () => {
    const grid = monthGrid('2026-09-15');
    expect(grid[0][0]).toBe('2026-08-31');
    expect(grid.at(-1)?.[6]).toBe('2026-10-04');
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });

  it('moves between months from any day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
  });

  it('uses Central time for today', () => {
    // 03:00 UTC on Sep 29 is still Sep 28 in Chicago.
    expect(today(new Date('2026-09-29T03:00:00Z'))).toBe('2026-09-28');
  });

  it('validates day strings', () => {
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2028-02-29')).toBe(true);
    expect(isDay('2026-9-1')).toBe(false);
  });

  it('labels ranges', () => {
    expect(rangeLabel('2026-09-28', '2026-10-04')).toBe('Sep 28 – Oct 4, 2026');
    expect(rangeLabel('2026-12-28', '2027-01-03')).toBe('Dec 28, 2026 – Jan 3, 2027');
  });
});

describe('timeAgo', () => {
  const now = new Date('2026-09-28T20:00:00Z'); // 3:00 PM Central
  it('reads like a person would say it', () => {
    expect(timeAgo('2026-09-28T19:59:40Z', now)).toBe('Just now');
    expect(timeAgo('2026-09-28T19:55:00Z', now)).toBe('5 min ago');
    expect(timeAgo('2026-09-28T14:00:00Z', now)).toBe('6 hr ago');
    expect(timeAgo('2026-09-28T04:00:00Z', now)).toBe('Yesterday'); // 11 PM Central the day before
    expect(timeAgo('2026-09-21T15:00:00Z', now)).toBe('Sep 21');
  });
});
