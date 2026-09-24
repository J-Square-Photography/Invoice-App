import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { computeShiftHours } from '@/lib/timesheet-calculations';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.timesheet.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
    if (existing.payslipId) {
      return NextResponse.json({ error: 'This shift has already been rolled into a payslip and is locked. Delete the payslip first to edit it.' }, { status: 409 });
    }

    const body = await request.json();
    const { date, startTime, endTime, breakMinutes, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (date !== undefined) updateData.date = new Date(date);
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (breakMinutes !== undefined) updateData.breakMinutes = Math.max(0, Math.min(720, Number(breakMinutes) || 0));
    if (notes !== undefined) updateData.notes = typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : null;

    const nextStart = (updateData.startTime as string) ?? existing.startTime;
    const nextEnd = (updateData.endTime as string) ?? existing.endTime;
    const nextBreak = (updateData.breakMinutes as number) ?? existing.breakMinutes;
    if (updateData.startTime || updateData.endTime || updateData.breakMinutes !== undefined) {
      const totalHours = computeShiftHours({ startTime: nextStart, endTime: nextEnd, breakMinutes: nextBreak });
      if (totalHours <= 0) {
        return NextResponse.json({ error: 'End time must be after start time (after the break is subtracted)' }, { status: 400 });
      }
      updateData.totalHours = totalHours;
    }

    const timesheet = await prisma.timesheet.update({
      where: { id },
      data: updateData,
      include: { staff: { select: { id: true, name: true } }, project: { select: { id: true, title: true } } },
    });
    return NextResponse.json({ timesheet });
  } catch (error) {
    console.error('Update timesheet error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const existing = await prisma.timesheet.findUnique({ where: { id }, select: { payslipId: true } });
    if (!existing) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
    if (existing.payslipId) {
      return NextResponse.json({ error: 'This shift has already been rolled into a payslip and is locked. Delete the payslip first.' }, { status: 409 });
    }
    await prisma.timesheet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete timesheet error:', error);
    return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
  }
}
