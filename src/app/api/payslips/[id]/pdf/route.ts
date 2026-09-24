import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { generatePayslipPDF } from '@/lib/payslip-generator';
import { getCompanySettings } from '@/lib/company-settings';
import type { StaffType } from '@/lib/staff-types';
import type { PayLineItem, PayGroupBreakdown } from '@/lib/timesheet-calculations';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const payslip = await prisma.payslip.findUnique({ where: { id }, include: { staff: true } });
  if (!payslip) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });

  try {
    const company = await getCompanySettings();
    const payslipNumber = `PS-${payslip.periodEnd.getFullYear()}-${payslip.id.slice(0, 6).toUpperCase()}`;
    // A payslip generated before per-shift rate breakdowns existed has no payBreakdown stored -
    // fall back to a single row built from its old blended totals so it still renders correctly.
    const breakdown = (payslip.payBreakdown as unknown as PayGroupBreakdown[] | null) ?? [
      {
        group: 'Basic Pay',
        hourlyRate: Number(payslip.hourlyRate),
        regularHours: Number(payslip.totalHours) - Number(payslip.overtimeHours),
        overtimeHours: Number(payslip.overtimeHours),
        basicPay: Number(payslip.basicPay),
        overtimePay: Number(payslip.overtimePay),
      },
    ];
    const pdfBytes = await generatePayslipPDF({
      payslipNumber,
      paymentDate: payslip.paidAt ?? payslip.updatedAt,
      periodStart: payslip.periodStart,
      periodEnd: payslip.periodEnd,
      staff: {
        name: payslip.staff.name,
        type: payslip.staff.type as StaffType,
        email: payslip.staff.email,
        bankName: payslip.staff.bankName,
        bankAccountNumber: payslip.staff.bankAccountNumber,
        payNowNumber: payslip.staff.payNowNumber,
      },
      breakdown,
      basicPay: Number(payslip.basicPay),
      overtimePay: Number(payslip.overtimePay),
      allowances: (payslip.allowances as unknown as PayLineItem[] | null) ?? [],
      deductions: (payslip.deductions as unknown as PayLineItem[] | null) ?? [],
      netPay: Number(payslip.netPay),
      status: payslip.status,
      company,
    });

    const filename = `Payslip-${payslip.staff.name.replace(/[^a-z0-9]+/gi, '-')}-${payslipNumber}.pdf`;
    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Payslip PDF generation error:', error);
    return NextResponse.json({ error: 'Failed to compile payslip PDF' }, { status: 500 });
  }
}
