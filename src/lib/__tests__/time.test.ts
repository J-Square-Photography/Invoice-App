import { describe, it, expect } from 'vitest';
import { startOfSingaporeDay, startOfSingaporeMonth, startOfSingaporeYear, currentSingaporeMonth, singaporeDateParts } from '../time';

describe('Singapore time', () => {
  // 30 Sep 2026, 17:00 UTC is already 1 Oct 2026, 01:00 in Singapore
  const lateNightUtc = new Date('2026-09-30T17:00:00Z');

  it('sees the next day when it is already tomorrow in Singapore', () => {
    expect(singaporeDateParts(lateNightUtc)).toEqual({ year: 2026, month: 10, day: 1 });
    expect(currentSingaporeMonth(lateNightUtc)).toBe('2026-10');
  });

  it('starts the day, month and year at midnight Singapore time', () => {
    expect(startOfSingaporeDay(lateNightUtc).toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(startOfSingaporeMonth(lateNightUtc).toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(startOfSingaporeYear(lateNightUtc).toISOString()).toBe('2025-12-31T16:00:00.000Z');
  });

  it('agrees with UTC when it is midday', () => {
    const noon = new Date('2026-09-22T04:00:00Z'); // noon in Singapore
    expect(singaporeDateParts(noon)).toEqual({ year: 2026, month: 9, day: 22 });
    expect(startOfSingaporeDay(noon).toISOString()).toBe('2026-09-21T16:00:00.000Z');
  });
});
