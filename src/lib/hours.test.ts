import { describe, expect, it } from '@jest/globals';

import { netHours, weeklyTotal } from './hours';

describe('netHours', () => {
  it('subtracts lunch', () => {
    expect(netHours({ start_time: '08:00', end_time: '16:30', lunch_start: '12:00', lunch_end: '12:30' })).toBe(8);
  });

  it('rounds to two decimals', () => {
    expect(netHours({ start_time: '08:00', end_time: '08:20', lunch_start: null, lunch_end: null })).toBe(0.33);
  });

  it('is null while clocked in', () => {
    expect(netHours({ start_time: '08:00', end_time: null, lunch_start: null, lunch_end: null })).toBeNull();
  });
});

describe('weeklyTotal', () => {
  it('skips open shifts', () => {
    expect(weeklyTotal([{ net_hours: 8 }, { net_hours: null }, { net_hours: 7.25 }])).toBe(15.25);
  });
});
