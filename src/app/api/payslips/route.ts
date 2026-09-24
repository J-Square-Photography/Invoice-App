import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { computePayFromShifts, computeNetPay, type PayLineItem, type ShiftForPay } from '@/lib/timesheet-calculations';
import { groupLabelFor } from '@/lib/staff-rate-card';
import { isSkillDiscipline } from '@/lib/skill-levels';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get('staffId');
  const status = searchParams.get('status');

  const payslips = await prisma.payslip.findMany({
    where: {
      ...(staffId ? { staffId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      staff: { select: { id: true, name: true, type: true } },
      _count: { select: { timesheets: true } },
    },
    orderBy: { periodStart: 'desc' },
  });

  return NextResponse.json({ payslips });
}

function cleanLineItems(value: unknown): PayLineItem[] {
  if (!Array.isArray(value)) return [];
  const out: PayLineItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const label = typeof (row as { label?: unknown }).label === 'string' ? (row as { label: string }).label.trim().slice(0, 100) : '';
    const amount = Number((row as { amount?: unknown }).amount);
    if (label && Number.isFinite(amount) && amount >= 0) out.push({ label, amount: Math.round(amount * 100) / 100 });
  }
  return out;
}

/** Generates a payslip for one staff member covering a period, rolling in every timesheet in that
 * range that hasn't already been billed on an earlier payslip (so re-running this after adding a
 * missed shift never double-counts hours). */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { staffId, periodStart, periodEnd, hourlyRate: rateOverride, allowances: rawAllowances, deductions: rawDeductions } = body;

    if (!staffId || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'staffId, periodStart and periodEnd are required' }, { status: 400 });
    }
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return NextResponse.json({ error: 'Invalid salary period' }, { status: 400 });
    }

    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });

    // End of day for periodEnd, so a shift logged on the last day of the period is included
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);

    const timesheets = await prisma.timesheet.findMany({
      where: { staffId, payslipId: null, date: { gte: start, lte: endOfDay } },
    });
    if (timesheets.length === 0) {
      return NextResponse.json({ error: 'No unbilled logged hours for this staff member in that period' }, { status: 400 });
    }

    // Each shift is priced at its own snapshotted rate (see /api/timesheets); the override here only
    // covers a legacy shift logged before rates were snapshotted per-shift.
    const fallbackRate = Number(rateOverride) > 0 ? Number(rateOverride) : null;
    const missingRate = timesheets.find((t) => t.hourlyRate == null && !fallbackRate);
    if (missingRate) {
      return NextResponse.json(
        { error: 'One of the logged shifts has no rate recorded. Provide a rate override to cover it.' },
        { status: 400 }
      );
    }

    const shifts: ShiftForPay[] = timesheets.map((t) => {
      const rate = t.hourlyRate != null ? Number(t.hourlyRate) : fallbackRate!;
      const group = t.discipline && isSkillDiscipline(t.discipline) ? groupLabelFor(t.discipline, rate) : `Other ($${rate.toFixed(2)}/hr)`;
      return { hours: Number(t.totalHours), hourlyRate: rate, group };
    });

    const pay = computePayFromShifts(shifts);
    const allowances = cleanLineItems(rawAllowances);
    const deductions = cleanLineItems(rawDeductions);
    const netPay = computeNetPay(pay.basicPay, pay.overtimePay, allowances, deductions);

    const payslip = await prisma.$transaction(async (tx) => {
      const created = await tx.payslip.create({
        data: {
          staffId,
          periodStart: start,
          periodEnd: end,
          totalHours: pay.totalHours,
          overtimeHours: pay.overtimeHours,
          hourlyRate: pay.hourlyRate,
          basicPay: pay.basicPay,
          overtimePay: pay.overtimePay,
          payBreakdown: pay.breakdown as unknown as object,
          allowances: allowances.length > 0 ? (allowances as unknown as object) : undefined,
          deductions: deductions.length > 0 ? (deductions as unknown as object) : undefined,
          netPay,
        },
      });
      await tx.timesheet.updateMany({
        where: { id: { in: timesheets.map((t) => t.id) } },
        data: { payslipId: created.id },
      });
      return created;
    });

    return NextResponse.json({ payslip }, { status: 201 });
  } catch (error) {
    console.error('Generate payslip error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
