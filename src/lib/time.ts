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

/**
 * Calculates a date string ('YYYY-MM-DD') exactly 1 month after a given base date (or today if omitted) in Singapore time.
 * Clamps days that overflow the target month (e.g. 31 Jan -> 28 Feb).
 */
export function addOneMonthSingapore(baseDate?: Date | string | null): string {
  let dateObj = baseDate ? (typeof baseDate === 'string' ? new Date(baseDate) : baseDate) : new Date();
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }
  const { year, month, day } = singaporeDateParts(dateObj);
  const targetYear = month === 12 ? year + 1 : year;
  const targetMonth = month === 12 ? 1 : month + 1;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInTargetMonth);
  return `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`;
}

/**
 * Returns the default payment due date (YYYY-MM-DD) for an invoice:
 * - 1 month after the project's event/shoot date if provided.
 * - 1 month from today (Singapore date) if no shoot date is provided.
 */
export function defaultInvoiceDueDate(shootDate?: Date | string | null): string {
  return addOneMonthSingapore(shootDate);
}

/**
 * Returns the default payment due date as a Date object for server-side invoice creation.
 */
export function defaultInvoiceDueDateObject(shootDate?: Date | string | null): Date {
  const ymd = defaultInvoiceDueDate(shootDate);
  return new Date(`${ymd}T00:00:00${SG_OFFSET}`);
}

