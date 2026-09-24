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

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One logged shift's hours and the pay rate that applies to it (a staff member can be paid
 * different rates across a period - different disciplines, or a rate-card change - so pay is
 * always computed shift by shift, never from one flat rate times a total). */
export interface ShiftForPay {
  hours: number;
  hourlyRate: number;
  /** Grouping key for the payslip breakdown, e.g. "Photography (Enthusiast)". Purely a label. */
  group: string;
}

export interface PayGroupBreakdown {
  group: string;
  hourlyRate: number;
  regularHours: number;
  overtimeHours: number;
  basicPay: number;
  overtimePay: number;
}

/** Basic + overtime pay for a set of shifts, each split into regular/overtime hours first (see
 * splitRegularAndOvertimeHours) then priced at its own rate, and rolled up both as a whole-period
 * total and as one row per pay group (see ShiftForPay.group) for an itemised payslip. */
export function computePayFromShifts(shifts: ShiftForPay[]): PayComputation & { breakdown: PayGroupBreakdown[] } {
  const byGroup = new Map<string, PayGroupBreakdown>();
  for (const shift of shifts) {
    const split = splitRegularAndOvertimeHours(shift.hours);
    const row = byGroup.get(shift.group) ?? {
      group: shift.group,
      hourlyRate: shift.hourlyRate,
      regularHours: 0,
      overtimeHours: 0,
      basicPay: 0,
      overtimePay: 0,
    };
    row.regularHours += split.regularHours;
    row.overtimeHours += split.overtimeHours;
    row.basicPay += split.regularHours * shift.hourlyRate;
    row.overtimePay += split.overtimeHours * shift.hourlyRate * OVERTIME_MULTIPLIER;
    byGroup.set(shift.group, row);
  }

  const breakdown = [...byGroup.values()].map((row) => ({
    ...row,
    regularHours: round2(row.regularHours),
    overtimeHours: round2(row.overtimeHours),
    basicPay: round2(row.basicPay),
    overtimePay: round2(row.overtimePay),
  }));

  const regularHours = breakdown.reduce((sum, r) => sum + r.regularHours, 0);
  const overtimeHours = breakdown.reduce((sum, r) => sum + r.overtimeHours, 0);
  const basicPay = round2(breakdown.reduce((sum, r) => sum + r.basicPay, 0));
  const overtimePay = round2(breakdown.reduce((sum, r) => sum + r.overtimePay, 0));
  // A single blended rate for a quick headline figure only; the breakdown above is the real math
  const hourlyRate = regularHours > 0 ? round2(basicPay / regularHours) : breakdown[0]?.hourlyRate ?? 0;

  return {
    totalHours: round2(regularHours + overtimeHours),
    regularHours: round2(regularHours),
    overtimeHours: round2(overtimeHours),
    hourlyRate,
    basicPay,
    overtimePay,
    breakdown,
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
