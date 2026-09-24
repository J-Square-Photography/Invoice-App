import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { isStaffType } from '@/lib/staff-types';

const clean = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const cleanDecimal = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const staff = await prisma.staff.findUnique({
    where: { id },
    include: {
      assignments: { include: { project: { include: { client: true } } }, orderBy: { createdAt: 'desc' } },
      timesheets: { include: { project: { select: { title: true } } }, orderBy: { date: 'desc' }, take: 50 },
      payslips: { orderBy: { periodStart: 'desc' } },
    },
  });
  if (!staff) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });

  return NextResponse.json({ staff });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, email, phone, type, role, hourlyRate, dayRate, bankName, bankAccountNumber, bankAccountName, payNowNumber, notes, isActive } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      updateData.name = name.trim().slice(0, 120);
    }
    if (email !== undefined) {
      const normalizedEmail = typeof email === 'string' && email.trim() ? email.toLowerCase().trim() : null;
      if (normalizedEmail) {
        const existing = await prisma.staff.findFirst({ where: { email: normalizedEmail, NOT: { id } } });
        if (existing) return NextResponse.json({ error: 'A staff member with this email already exists' }, { status: 409 });
      }
      updateData.email = normalizedEmail;
    }
    if (phone !== undefined) updateData.phone = clean(phone, 30);
    if (type !== undefined) updateData.type = isStaffType(type) ? type : 'PT';
    if (role !== undefined) updateData.role = clean(role, 120);
    if (hourlyRate !== undefined) updateData.hourlyRate = cleanDecimal(hourlyRate);
    if (dayRate !== undefined) updateData.dayRate = cleanDecimal(dayRate);
    if (bankName !== undefined) updateData.bankName = clean(bankName, 100);
    if (bankAccountNumber !== undefined) updateData.bankAccountNumber = clean(bankAccountNumber, 40);
    if (bankAccountName !== undefined) updateData.bankAccountName = clean(bankAccountName, 100);
    if (payNowNumber !== undefined) updateData.payNowNumber = clean(payNowNumber, 30);
    if (notes !== undefined) updateData.notes = clean(notes, 2000);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const staff = await prisma.staff.update({ where: { id }, data: updateData });
    return NextResponse.json({ staff });
  } catch (error) {
    console.error('Update staff error:', error);
    return NextResponse.json({ error: 'Staff member not found or update failed' }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    await prisma.staff.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete staff error:', error);
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
  }
}
