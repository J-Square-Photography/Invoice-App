import { describe, it, expect } from 'vitest';
import { byText, byNumber, byDate, sortItems, inPeriod, type SortChoice } from '../sorting';

interface Row {
  name: string;
  amount: number;
  date: string | null;
}

const rows: Row[] = [
  { name: 'beta', amount: 50, date: '2026-03-10' },
  { name: 'Alpha', amount: 200, date: null },
  { name: 'gamma 10', amount: 10, date: '2026-01-05' },
  { name: 'gamma 2', amount: 75, date: '2026-06-01' },
];

const choices: SortChoice<Row>[] = [
  { value: 'az', label: 'A-Z', compare: byText((r) => r.name) },
  { value: 'za', label: 'Z-A', compare: byText((r) => r.name, 'desc') },
  { value: 'high', label: 'High', compare: byNumber((r) => r.amount, 'desc') },
  { value: 'low', label: 'Low', compare: byNumber((r) => r.amount) },
  { value: 'newest', label: 'Newest', compare: byDate((r) => r.date, 'desc') },
  { value: 'oldest', label: 'Oldest', compare: byDate((r) => r.date) },
];
const names = (v: string) => sortItems(rows, choices, v).map((r) => r.name);

describe('sortItems', () => {
  it('sorts text ignoring case, with numbers in natural order', () => {
    expect(names('az')).toEqual(['Alpha', 'beta', 'gamma 2', 'gamma 10']);
    expect(names('za')).toEqual(['gamma 10', 'gamma 2', 'beta', 'Alpha']);
  });

  it('sorts by amount both ways', () => {
    expect(names('high')).toEqual(['Alpha', 'gamma 2', 'beta', 'gamma 10']);
    expect(names('low')).toEqual(['gamma 10', 'beta', 'gamma 2', 'Alpha']);
  });

  it('sorts by date, and items with no date always go last', () => {
    expect(names('newest')).toEqual(['gamma 2', 'beta', 'gamma 10', 'Alpha']);
    expect(names('oldest')).toEqual(['gamma 10', 'beta', 'gamma 2', 'Alpha']);
  });

  it('leaves the list as it was for an unknown choice, and never changes the original', () => {
    expect(names('nope')).toEqual(['beta', 'Alpha', 'gamma 10', 'gamma 2']);
    names('az');
    expect(rows.map((r) => r.name)).toEqual(['beta', 'Alpha', 'gamma 10', 'gamma 2']);
  });
});

describe('inPeriod', () => {
  const now = new Date(2026, 8, 22, 15, 0); // 22 Sep 2026

  it('any time includes everything, even a missing date', () => {
    expect(inPeriod(null, 'ALL', now)).toBe(true);
  });

  it('this month starts on the 1st', () => {
    expect(inPeriod(new Date(2026, 8, 1), 'THIS_MONTH', now)).toBe(true);
    expect(inPeriod(new Date(2026, 7, 31), 'THIS_MONTH', now)).toBe(false);
  });

  it('last 30 days includes today and the 29 days before', () => {
    expect(inPeriod(new Date(2026, 8, 22), 'LAST_30', now)).toBe(true);
    expect(inPeriod(new Date(2026, 7, 24), 'LAST_30', now)).toBe(true);
    expect(inPeriod(new Date(2026, 7, 23), 'LAST_30', now)).toBe(false);
  });

  it('this year and last 3 months', () => {
    expect(inPeriod(new Date(2026, 0, 1), 'THIS_YEAR', now)).toBe(true);
    expect(inPeriod(new Date(2025, 11, 31), 'THIS_YEAR', now)).toBe(false);
    expect(inPeriod(new Date(2026, 5, 25), 'LAST_90', now)).toBe(true);
    expect(inPeriod(new Date(2026, 5, 1), 'LAST_90', now)).toBe(false);
  });

  it('a missing date does not match a real period', () => {
    expect(inPeriod(null, 'THIS_MONTH', now)).toBe(false);
  });
});
