import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { computeNetPay, type PayLineItem } from '@/lib/timesheet-calculations';
import { isPayslipStatus } from '@/lib/staff-types';

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const payslip = await prisma.payslip.findUnique({
    where: { id },
    include: { staff: true, timesheets: { include: { project: { select: { title: true } } }, orderBy: { date: 'asc' } } },
  });
  if (!payslip) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
  return NextResponse.json({ payslip });
}

/** Edits are limited to a DRAFT payslip's allowances/deductions/status - once PAID, it's a record of
 * what was actually paid and stays fixed (same reasoning as a sent invoice). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.payslip.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });

    const body = await request.json();
    const { status, allowances: rawAllowances, deductions: rawDeductions, notes } = body;

    if ((rawAllowances !== undefined || rawDeductions !== undefined) && existing.status === 'PAID') {
      return NextResponse.json({ error: 'A paid payslip is locked. Its line items cannot be changed.' }, { status: 409 });
    }

    const updateData: Record<string, unknown> = {};
    const allowances = rawAllowances !== undefined ? cleanLineItems(rawAllowances) : (existing.allowances as unknown as PayLineItem[] | null) ?? [];
    const deductions = rawDeductions !== undefined ? cleanLineItems(rawDeductions) : (existing.deductions as unknown as PayLineItem[] | null) ?? [];
    if (rawAllowances !== undefined) updateData.allowances = allowances.length > 0 ? (allowances as unknown as object) : null;
    if (rawDeductions !== undefined) updateData.deductions = deductions.length > 0 ? (deductions as unknown as object) : null;
    if (rawAllowances !== undefined || rawDeductions !== undefined) {
      updateData.netPay = computeNetPay(Number(existing.basicPay), Number(existing.overtimePay), allowances, deductions);
    }
    if (notes !== undefined) updateData.notes = typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 1000) : null;
    if (status !== undefined) {
      if (!isPayslipStatus(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      updateData.status = status;
      updateData.paidAt = status === 'PAID' ? new Date() : null;
    }

    const payslip = await prisma.payslip.update({ where: { id }, data: updateData, include: { staff: true } });
    return NextResponse.json({ payslip });
  } catch (error) {
    console.error('Update payslip error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

/** Deleting a payslip un-links its timesheets (they go back to "unbilled" instead of vanishing),
 * so a mistaken payslip can be safely thrown away and regenerated. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const existing = await prisma.payslip.findUnique({ where: { id }, select: { status: true } });
    if (!existing) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    if (existing.status === 'PAID') {
      return NextResponse.json({ error: 'A paid payslip cannot be deleted. It is a record of a real payment.' }, { status: 409 });
    }
    await prisma.$transaction([
      prisma.timesheet.updateMany({ where: { payslipId: id }, data: { payslipId: null } }),
      prisma.payslip.delete({ where: { id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete payslip error:', error);
    return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
  }
}
