import { describe, it, expect } from 'vitest';
import { computeShiftHours, splitRegularAndOvertimeHours, computePayFromShifts, computeNetPay } from '../timesheet-calculations';

describe('computeShiftHours', () => {
  it('subtracts the break from a plain shift', () => {
    expect(computeShiftHours({ startTime: '09:00', endTime: '17:00', breakMinutes: 60 })).toBe(7);
  });

  it('defaults to no break when none is given', () => {
    expect(computeShiftHours({ startTime: '09:00', endTime: '12:00' })).toBe(3);
  });

  it('rounds to the nearest quarter hour', () => {
    expect(computeShiftHours({ startTime: '09:00', endTime: '13:10', breakMinutes: 0 })).toBe(4.25);
  });

  it('wraps an overnight shift past midnight', () => {
    expect(computeShiftHours({ startTime: '22:00', endTime: '02:00', breakMinutes: 0 })).toBe(4);
  });

  it('never goes negative when a break exceeds the shift', () => {
    expect(computeShiftHours({ startTime: '09:00', endTime: '09:30', breakMinutes: 60 })).toBe(0);
  });
});

describe('splitRegularAndOvertimeHours', () => {
  it('is all regular hours under the 8-hour threshold', () => {
    expect(splitRegularAndOvertimeHours(6)).toEqual({ regularHours: 6, overtimeHours: 0 });
  });

  it('splits anything past 8 hours in a day into overtime', () => {
    expect(splitRegularAndOvertimeHours(10)).toEqual({ regularHours: 8, overtimeHours: 2 });
  });

  it('is exactly at the boundary with no overtime', () => {
    expect(splitRegularAndOvertimeHours(8)).toEqual({ regularHours: 8, overtimeHours: 0 });
  });
});

describe('computePayFromShifts', () => {
  it('pays regular hours at the plain rate', () => {
    const result = computePayFromShifts([
      { hours: 8, hourlyRate: 20, group: 'Photography (Novice)' },
      { hours: 6, hourlyRate: 20, group: 'Photography (Novice)' },
    ]);
    expect(result.regularHours).toBe(14);
    expect(result.overtimeHours).toBe(0);
    expect(result.basicPay).toBe(280);
    expect(result.overtimePay).toBe(0);
  });

  it('pays overtime at 1.5x, taken day by day', () => {
    // Day 1: 10 hours (8 regular + 2 OT). Day 2: 5 hours (all regular).
    const result = computePayFromShifts([
      { hours: 10, hourlyRate: 20, group: 'Photography (Novice)' },
      { hours: 5, hourlyRate: 20, group: 'Photography (Novice)' },
    ]);
    expect(result.regularHours).toBe(13);
    expect(result.overtimeHours).toBe(2);
    expect(result.basicPay).toBe(260);
    expect(result.overtimePay).toBe(60); // 2 * 20 * 1.5
    expect(result.totalHours).toBe(15);
  });

  it('keeps different disciplines/rates as separate breakdown rows', () => {
    const result = computePayFromShifts([
      { hours: 8, hourlyRate: 60, group: 'Photography (Enthusiast)' },
      { hours: 6, hourlyRate: 100, group: 'Videography (Enthusiast)' },
    ]);
    expect(result.regularHours).toBe(14);
    expect(result.basicPay).toBe(8 * 60 + 6 * 100);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown.find((b) => b.group === 'Photography (Enthusiast)')?.basicPay).toBe(480);
    expect(result.breakdown.find((b) => b.group === 'Videography (Enthusiast)')?.basicPay).toBe(600);
  });

  it('merges shifts in the same group and still applies overtime per day within it', () => {
    const result = computePayFromShifts([
      { hours: 10, hourlyRate: 60, group: 'Photography (Enthusiast)' },
      { hours: 8, hourlyRate: 60, group: 'Photography (Enthusiast)' },
    ]);
    expect(result.breakdown).toHaveLength(1);
    const row = result.breakdown[0];
    expect(row.regularHours).toBe(16);
    expect(row.overtimeHours).toBe(2);
    expect(row.basicPay).toBe(16 * 60);
    expect(row.overtimePay).toBe(2 * 60 * 1.5);
  });
});

describe('computeNetPay', () => {
  it('adds allowances and subtracts deductions from basic + overtime', () => {
    const net = computeNetPay(
      1000,
      100,
      [{ label: 'Transport', amount: 50 }, { label: 'Meal', amount: 30 }],
      [{ label: 'Unpaid leave', amount: 40 }]
    );
    expect(net).toBe(1140);
  });

  it('is just basic pay with no allowances or deductions', () => {
    expect(computeNetPay(500, 0, [], [])).toBe(500);
  });
});
