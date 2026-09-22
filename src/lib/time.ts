/**
 * The studio works in Singapore time (UTC+8, no daylight saving). The server runs in UTC, so
 * "today", "this month" and "overdue" would otherwise flip 8 hours late. These return the exact
 * instants at which the Singapore day, month and year begin.
 */
const SG_OFFSET = '+08:00';

/** Year, month (1-12) and day of the given moment as seen in Singapore. */
export function singaporeDateParts(now: Date = new Date()): { year: number; month: number; day: number } {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function startOfSingaporeDay(now: Date = new Date()): Date {
  const { year, month, day } = singaporeDateParts(now);
  return new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00${SG_OFFSET}`);
}

export function startOfSingaporeMonth(now: Date = new Date()): Date {
  const { year, month } = singaporeDateParts(now);
  return new Date(`${year}-${pad(month)}-01T00:00:00${SG_OFFSET}`);
}

export function startOfSingaporeYear(now: Date = new Date()): Date {
  const { year } = singaporeDateParts(now);
  return new Date(`${year}-01-01T00:00:00${SG_OFFSET}`);
}

/** "2026-09", the month picker's format, for the current Singapore month. */
export function currentSingaporeMonth(now: Date = new Date()): string {
  const { year, month } = singaporeDateParts(now);
  return `${year}-${pad(month)}`;
}
