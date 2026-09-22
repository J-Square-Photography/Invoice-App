/**
 * Sorting and period helpers shared by every list page (invoices, quotes, payments, clients,
 * projects, contracts). Lists are small, so they are sorted in the browser.
 */
export type Compare<T> = (a: T, b: T) => number;

export interface SortChoice<T> {
  value: string;
  label: string;
  compare: Compare<T>;
}

/** Text, ignoring case and treating "Invoice 2" before "Invoice 10". */
export const byText = <T>(get: (item: T) => string | null | undefined, dir: 'asc' | 'desc' = 'asc'): Compare<T> => {
  const sign = dir === 'asc' ? 1 : -1;
  return (a, b) => sign * (get(a) ?? '').localeCompare(get(b) ?? '', undefined, { sensitivity: 'base', numeric: true });
};

export const byNumber = <T>(get: (item: T) => number | null | undefined, dir: 'asc' | 'desc' = 'asc'): Compare<T> => {
  const sign = dir === 'asc' ? 1 : -1;
  return (a, b) => sign * ((get(a) ?? 0) - (get(b) ?? 0));
};

/** Dates. Items with no date always go last, whichever way the list is sorted. */
export const byDate = <T>(get: (item: T) => string | Date | null | undefined, dir: 'asc' | 'desc' = 'asc'): Compare<T> => {
  const sign = dir === 'asc' ? 1 : -1;
  const time = (v: string | Date | null | undefined) => (v ? new Date(v).getTime() : NaN);
  return (a, b) => {
    const ta = time(get(a));
    const tb = time(get(b));
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return sign * (ta - tb);
  };
};

/** Sorts a copy of the list by the chosen option (unchanged order if the choice is unknown). */
export function sortItems<T>(items: readonly T[], choices: ReadonlyArray<SortChoice<T>>, value: string): T[] {
  const choice = choices.find((c) => c.value === value);
  const copy = [...items];
  if (!choice) return copy;
  // Array.prototype.sort is stable, so equal items keep the order the server gave them
  return copy.sort(choice.compare);
}

/** "This month", "Last 30 days", ... used to narrow a list by date. */
export const PERIODS = [
  { value: 'ALL', label: 'Any time' },
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_30', label: 'Last 30 days' },
  { value: 'LAST_90', label: 'Last 3 months' },
  { value: 'THIS_YEAR', label: 'This year' },
] as const;

export type PeriodKey = (typeof PERIODS)[number]['value'];

export function inPeriod(date: string | Date | null | undefined, period: string, now: Date = new Date()): boolean {
  if (period === 'ALL') return true;
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  switch (period) {
    case 'THIS_MONTH':
      return t >= new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case 'LAST_30':
      return t >= startOfToday - 29 * 86400000;
    case 'LAST_90':
      return t >= startOfToday - 89 * 86400000;
    case 'THIS_YEAR':
      return t >= new Date(now.getFullYear(), 0, 1).getTime();
    default:
      return true;
  }
}
