import { describe, expect, it } from '@jest/globals';

import {
  endBeforeStartMessage,
  moveId,
  parseTime,
  shiftConflicts,
  shiftTimeLabel,
  sortShifts,
  unusualSentence,
  unusualTimes,
  visibleWeekDays,
} from './schedule';

const shift = (id: string, day: string, start: string | null = null, crew = 'a') => ({
  id,
  crew_id: crew,
  shift_date: day,
  start_time: start,
  end_time: null,
});

describe('schedule rules', () => {
  const week = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];

  it('hides empty weekends', () => {
    expect(visibleWeekDays(week, { shifts: [], timeOff: [], holidays: [] })).toHaveLength(5);
  });

  it('shows a weekend day with a shift, time off, or holiday', () => {
    expect(visibleWeekDays(week, { shifts: [shift('1', '2026-10-03')], timeOff: [], holidays: [] }).at(-1)).toBe(
      '2026-10-03',
    );
    expect(
      visibleWeekDays(week, {
        shifts: [],
        timeOff: [{ crew_id: 'a', start_date: '2026-10-02', end_date: '2026-10-05', type: null }],
        holidays: [],
      }),
    ).toHaveLength(7);
    expect(
      visibleWeekDays(week, { shifts: [], timeOff: [], holidays: [{ holiday_date: '2026-10-04', name: 'X' }] }),
    ).toHaveLength(6);
  });

  it('sorts untimed shifts last', () => {
    const sorted = sortShifts([shift('u', 'd'), shift('b', 'd', '13:00'), shift('a', 'd', '08:00')]);
    expect(sorted.map((s) => s.id)).toEqual(['a', 'b', 'u']);
  });

  it('finds holiday and time-off conflicts', () => {
    const c = shiftConflicts(
      shift('1', '2026-12-25'),
      [{ crew_id: 'a', start_date: '2026-12-24', end_date: '2026-12-26', type: 'sick' }],
      [{ holiday_date: '2026-12-25', name: 'Christmas' }],
    );
    expect(c.map((x) => x.kind)).toEqual(['holiday', 'time-off']);
    expect(c[1]).toMatchObject({ sick: true });
    expect(shiftConflicts(shift('2', '2026-12-25', null, 'b'), [], [])).toEqual([]);
  });

  it('reads typed times', () => {
    expect(parseTime('9')).toBe('09:00');
    expect(parseTime('930')).toBe('09:30');
    expect(parseTime('2:15 pm')).toBe('14:15');
    expect(parseTime('12am')).toBe('00:00');
    expect(parseTime('12 PM')).toBe('12:00');
    expect(parseTime('17:45')).toBe('17:45');
    expect(parseTime('')).toBeNull();
    expect(parseTime('25:00')).toBeUndefined();
    expect(parseTime('13pm')).toBeUndefined();
    expect(parseTime('soon')).toBeUndefined();
  });

  it('labels shift times', () => {
    expect(shiftTimeLabel({ start_time: '08:00:00', end_time: '16:30:00' })).toBe('8:00 AM – 4:30 PM');
    expect(shiftTimeLabel({ start_time: null, end_time: null })).toBe('No set time');
  });

  it('moves crew up and down', () => {
    expect(moveId(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b']);
    expect(moveId(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c']);
  });
});

describe('time typo checks', () => {
  it('suggests the AM/PM fix when the end is before the start', () => {
    expect(endBeforeStartMessage('21:00', '12:00')).toBe(
      'End must be after the start. Did you mean 9:00 AM – 12:00 PM?',
    );
    expect(endBeforeStartMessage('09:00', '05:00')).toBe(
      'End must be after the start. Did you mean 9:00 AM – 5:00 PM?',
    );
    expect(endBeforeStartMessage('10:00', '10:00')).toBe('End must be after the start.');
  });

  it('flags late, early, long, and very short times', () => {
    expect(unusualTimes('09:00', '17:00')).toEqual([]);
    expect(unusualTimes('21:00', '23:30')).toEqual(['starts at 9:00 PM', 'ends at 11:30 PM']);
    expect(unusualTimes('04:30', null)).toEqual(['starts at 4:30 AM']);
    expect(unusualTimes('06:00', '19:30')).toEqual(['is 13.5 hours long']);
    expect(unusualTimes('09:00', '09:15')).toEqual(['is only 15 minutes long']);
    expect(unusualSentence('This shift', ['starts at 9:00 PM', 'ends at 11:30 PM'])).toBe(
      'This shift starts at 9:00 PM and ends at 11:30 PM. Save it anyway?',
    );
  });
});
