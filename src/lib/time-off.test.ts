import { describe, expect, it } from '@jest/globals';

import { coverageFor, dayCount, pickRange, rangeDays, rangeText, readHours } from './time-off';

describe('time off rules', () => {
  it('counts inclusive calendar days', () => {
    expect(dayCount({ start_date: '2026-10-30', end_date: '2026-11-02' })).toBe(4);
    expect(rangeDays({ start_date: '2026-10-31', end_date: '2026-11-01' })).toEqual(['2026-10-31', '2026-11-01']);
  });

  it('describes ranges', () => {
    expect(rangeText({ start_date: '2026-10-05', end_date: '2026-10-05' })).toBe('Oct 5');
    expect(rangeText({ start_date: '2026-10-05', end_date: '2026-10-07' })).toBe('Oct 5 – Oct 7 · 3 days');
  });

  it('picks a range by tapping', () => {
    let r = pickRange({ start: null, end: null }, '2026-10-05');
    expect(r).toEqual({ start: '2026-10-05', end: null });
    r = pickRange(r, '2026-10-08');
    expect(r).toEqual({ start: '2026-10-05', end: '2026-10-08' });
    expect(pickRange(r, '2026-10-20')).toEqual({ start: '2026-10-20', end: null });
    expect(pickRange({ start: '2026-10-05', end: null }, '2026-10-01')).toEqual({ start: '2026-10-01', end: null });
    expect(pickRange({ start: '2026-10-05', end: null }, '2026-10-05')).toEqual({
      start: '2026-10-05',
      end: '2026-10-05',
    });
  });

  it('warns about overlapping days off and pending requests from others', () => {
    const req = { id: 'r1', crew_id: 'a', start_date: '2026-10-05', end_date: '2026-10-07' };
    const cov = coverageFor(
      req,
      [
        { crew_id: 'b', start_date: '2026-10-07', end_date: '2026-10-09' },
        { crew_id: 'c', start_date: '2026-10-08', end_date: '2026-10-09' },
        { crew_id: 'a', start_date: '2026-10-05', end_date: '2026-10-05' },
      ],
      [
        req,
        { id: 'r2', crew_id: 'd', start_date: '2026-10-01', end_date: '2026-10-05' },
        { id: 'r3', crew_id: 'b', start_date: '2026-10-06', end_date: '2026-10-06' },
      ],
    );
    expect(cov).toEqual([
      { crew_id: 'b', kind: 'off' },
      { crew_id: 'd', kind: 'pending' },
    ]);
  });

  it('describes and reads part of a day', () => {
    expect(
      rangeText({ start_date: '2026-10-05', end_date: '2026-10-05', start_time: '12:00:00', end_time: '17:00:00' }),
    ).toBe('Oct 5 · 12:00 PM – 5:00 PM');
    expect(readHours('lunch', '5pm').errors.from).toBe('Use a time like 12:00 PM.');
    expect(readHours('12pm', '5pm')).toEqual({ values: { start_time: '12:00', end_time: '17:00' }, errors: {} });
    expect(readHours('', '5pm').errors).toEqual({ from: 'Enter when time off starts.' });
    expect(readHours('5pm', '12pm').values).toBeNull();
  });
});
