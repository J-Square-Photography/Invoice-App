import { describe, it, expect } from 'vitest';
import {
  startOfSingaporeDay,
  startOfSingaporeMonth,
  startOfSingaporeYear,
  currentSingaporeMonth,
  singaporeDateParts,
  singaporeDateString,
  parseOptionalDate,
  isBeforeIssueDate,
  addOneMonthSingapore,
  defaultInvoiceDueDate,
  defaultInvoiceDueDateObject,
} from '../time';

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

  describe('default invoice due date (1 month after event or today)', () => {
    it('calculates exactly 1 month after event date', () => {
      // 26 Sep 2026 -> 26 Oct 2026
      expect(defaultInvoiceDueDate('2026-09-26T00:00:00.000Z')).toBe('2026-10-26');
      expect(defaultInvoiceDueDate('2026-09-26')).toBe('2026-10-26');
      // Year turnover: 15 Dec 2026 -> 15 Jan 2027
      expect(defaultInvoiceDueDate('2026-12-15T00:00:00.000Z')).toBe('2027-01-15');
    });

    it('clamps to the last day of shorter months (e.g. 31 Jan -> 28 Feb in non-leap year)', () => {
      expect(defaultInvoiceDueDate('2027-01-31T00:00:00.000Z')).toBe('2027-02-28');
    });

    it('falls back to 1 month from today when shoot date is not provided', () => {
      const todayParts = singaporeDateParts(new Date());
      const expectedDue = addOneMonthSingapore(new Date());
      expect(defaultInvoiceDueDate(null)).toBe(expectedDue);
      expect(defaultInvoiceDueDate(undefined)).toBe(expectedDue);
    });

    it('generates a valid Date object in Singapore timezone', () => {
      const dueDateObj = defaultInvoiceDueDateObject('2026-09-26');
      expect(dueDateObj).toBeInstanceOf(Date);
      expect(singaporeDateParts(dueDateObj)).toEqual({ year: 2026, month: 10, day: 26 });
    });
  });
});


describe('issue date helpers', () => {
  it('gives the Singapore calendar date, even when it is still the previous day in UTC', () => {
    expect(singaporeDateString(new Date('2026-11-11T17:30:00Z'))).toBe('2026-11-12');
    expect(singaporeDateString('2026-11-12')).toBe('2026-11-12');
  });

  it('reads an optional date from a request body', () => {
    expect(parseOptionalDate(undefined)).toBeUndefined();
    expect(parseOptionalDate('')).toBeUndefined();
    expect(parseOptionalDate('not a date')).toBe('invalid');
    expect(parseOptionalDate('2026-11-12')).toEqual(new Date('2026-11-12'));
  });

  it('flags a due date earlier than the issue date, but allows the same day', () => {
    expect(isBeforeIssueDate('2026-11-11', '2026-11-12')).toBe(true);
    expect(isBeforeIssueDate('2026-11-12', '2026-11-12')).toBe(false);
    expect(isBeforeIssueDate('2026-11-12', new Date('2026-11-12T09:00:00+08:00'))).toBe(false);
  });
});
