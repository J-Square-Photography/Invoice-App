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

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  // Also backs the staff picker inside "Create New Project" assignment UI.
  if (!hasPermission(user, 'staff') && !hasPermission(user, 'projects')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const activeOnly = searchParams.get('activeOnly') === 'true';

  const staff = await prisma.staff.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { role: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { assignments: true, timesheets: true, payslips: true } },
    },
    orderBy: { name: 'asc' },
  });

  // Bank/PayNow details are sensitive: only actually shown to someone with the staff permission
  // (a Manager who can only see the staff picker for project assignment gets the bare minimum).
  const canSeeFull = hasPermission(user, 'staff');
  const shaped = staff.map((s) => (canSeeFull ? s : { id: s.id, name: s.name, type: s.type, role: s.role, isActive: s.isActive }));

  return NextResponse.json({ staff: shaped });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { name, email, phone, type, role, hourlyRate, dayRate, bankName, bankAccountNumber, bankAccountName, payNowNumber, notes } = body;

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const validType = typeof type === 'string' && isStaffType(type) ? type : 'PT';

    const normalizedEmail = typeof email === 'string' && email.trim() ? email.toLowerCase().trim() : null;
    if (normalizedEmail) {
      const existing = await prisma.staff.findUnique({ where: { email: normalizedEmail } });
      if (existing) return NextResponse.json({ error: 'A staff member with this email already exists' }, { status: 409 });
    }

    const staff = await prisma.staff.create({
      data: {
        name: name.trim().slice(0, 120),
        email: normalizedEmail,
        phone: clean(phone, 30),
        type: validType,
        role: clean(role, 120),
        hourlyRate: cleanDecimal(hourlyRate),
        dayRate: cleanDecimal(dayRate),
        bankName: clean(bankName, 100),
        bankAccountNumber: clean(bankAccountNumber, 40),
        bankAccountName: clean(bankAccountName, 100),
        payNowNumber: clean(payNowNumber, 30),
        notes: clean(notes, 2000),
      },
    });

    return NextResponse.json({ staff }, { status: 201 });
  } catch (error) {
    console.error('Create staff error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
