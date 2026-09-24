import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { computePayFromShifts, computeNetPay, type PayLineItem, type ShiftForPay } from '@/lib/timesheet-calculations';
import { shiftGroupLabel } from '@/lib/staff-rate-card';

/** Pulls one shift back off its payslip so it can be edited or deleted, in case it was logged with
 * the wrong details. The payslip it was on is recomputed from whatever shifts remain on it (or
 * deleted outright if this was the only one) - its allowances/deductions are left as they were,
 * since there's no way to tell which of them came from this specific shift's equipment flags. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const timesheet = await prisma.timesheet.findUnique({ where: { id } });
    if (!timesheet) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
    if (!timesheet.payslipId) return NextResponse.json({ error: 'This shift is not billed' }, { status: 400 });

    const payslip = await prisma.payslip.findUnique({ where: { id: timesheet.payslipId } });
    if (!payslip) {
      // Orphaned reference - just unlink it
      await prisma.timesheet.update({ where: { id }, data: { payslipId: null } });
      return NextResponse.json({ success: true });
    }
    if (payslip.status === 'PAID') {
      return NextResponse.json({ error: 'This payslip is marked paid. Revert it to Draft first, then try again.' }, { status: 409 });
    }

    const remaining = await prisma.timesheet.findMany({ where: { payslipId: payslip.id, NOT: { id } } });

    await prisma.$transaction(async (tx) => {
      await tx.timesheet.update({ where: { id }, data: { payslipId: null } });
      if (remaining.length === 0) {
        await tx.payslip.delete({ where: { id: payslip.id } });
        return;
      }
      const shifts: ShiftForPay[] = remaining.map((t) => {
        const rate = Number(t.hourlyRate ?? 0);
        return { hours: Number(t.totalHours), hourlyRate: rate, group: shiftGroupLabel(t.discipline, rate, t.photoboothPackage) };
      });
      const pay = computePayFromShifts(shifts);
      const allowances = ((payslip.allowances as unknown as PayLineItem[]) ?? []);
      const deductions = ((payslip.deductions as unknown as PayLineItem[]) ?? []);
      const netPay = computeNetPay(pay.basicPay, pay.overtimePay, allowances, deductions);
      await tx.payslip.update({
        where: { id: payslip.id },
        data: {
          totalHours: pay.totalHours,
          overtimeHours: pay.overtimeHours,
          hourlyRate: pay.hourlyRate,
          basicPay: pay.basicPay,
          overtimePay: pay.overtimePay,
          payBreakdown: pay.breakdown as unknown as object,
          netPay,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unbill timesheet error:', error);
    return NextResponse.json({ error: 'Failed to revert this shift to unbilled' }, { status: 500 });
  }
}
