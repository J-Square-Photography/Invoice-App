/** Shared math for logging shifts and rolling them into a payslip. */

export interface RawShiftInput {
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  breakMinutes?: number | null;
}

/** Minutes between two "HH:MM" times, wrapping past midnight for an overnight shift. */
function minutesBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60; // shift crossed midnight
  return minutes;
}

/** Total billable hours for one shift: (end - start), less any break, rounded to the nearest
 * quarter-hour (the usual granularity for timesheet-based pay). */
export function computeShiftHours({ startTime, endTime, breakMinutes }: RawShiftInput): number {
  const worked = minutesBetween(startTime, endTime) - (breakMinutes || 0);
  const hours = Math.max(0, worked) / 60;
  return Math.round(hours * 4) / 4;
}

/** Singapore's Employment Act treats work beyond 8 hours in a day as overtime (Part IV, for
 * covered employees) - this is the simple, day-by-day version of that rule. A shift is logged as
 * a single day already, so it applies per-timesheet-row rather than needing a weekly rollup. */
const STANDARD_HOURS_PER_DAY = 8;

export function splitRegularAndOvertimeHours(totalHours: number): { regularHours: number; overtimeHours: number } {
  const regularHours = Math.min(totalHours, STANDARD_HOURS_PER_DAY);
  const overtimeHours = Math.max(0, totalHours - STANDARD_HOURS_PER_DAY);
  return { regularHours, overtimeHours };
}

export interface PayComputation {
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number;
  basicPay: number;
  overtimePay: number;
}

/** Overtime is paid at 1.5x the basic hourly rate - the standard Singapore OT multiplier. */
const OVERTIME_MULTIPLIER = 1.5;

/** Basic + overtime pay for a set of shifts, each split into regular/overtime hours first (see
 * splitRegularAndOvertimeHours), then summed and priced at the staff member's hourly rate. */
export function computePayFromShifts(shiftHours: number[], hourlyRate: number): PayComputation {
  let regularHours = 0;
  let overtimeHours = 0;
  for (const hours of shiftHours) {
    const split = splitRegularAndOvertimeHours(hours);
    regularHours += split.regularHours;
    overtimeHours += split.overtimeHours;
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const basicPay = round2(regularHours * hourlyRate);
  const overtimePay = round2(overtimeHours * hourlyRate * OVERTIME_MULTIPLIER);
  return {
    totalHours: round2(regularHours + overtimeHours),
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
    hourlyRate,
    basicPay,
    overtimePay,
  };
}

export interface PayLineItem {
  label: string;
  amount: number;
}

/** Net pay: basic + overtime + allowances, less deductions. */
export function computeNetPay(
  basicPay: number,
  overtimePay: number,
  allowances: PayLineItem[],
  deductions: PayLineItem[]
): number {
  const allowanceTotal = allowances.reduce((sum, a) => sum + a.amount, 0);
  const deductionTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
  return Math.round((basicPay + overtimePay + allowanceTotal - deductionTotal) * 100) / 100;
}
