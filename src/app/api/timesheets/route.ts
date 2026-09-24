import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { computeShiftHours } from '@/lib/timesheet-calculations';
import { isSkillDiscipline } from '@/lib/skill-levels';
import { staffHourlyRateFor } from '@/lib/staff-rate-card';
import type { StaffSkill } from '@/lib/skill-levels';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get('staffId');
  const projectId = searchParams.get('projectId');
  const unbilledOnly = searchParams.get('unbilledOnly') === 'true';
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const timesheets = await prisma.timesheet.findMany({
    where: {
      ...(staffId ? { staffId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(unbilledOnly ? { payslipId: null } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: {
      staff: { select: { id: true, name: true } },
      project: { select: { id: true, title: true, client: { select: { companyName: true } } } },
    },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json({ timesheets });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { staffId, projectId, date, startTime, endTime, breakMinutes, discipline, hourlyRate: rateOverride, notes } = body;

    if (!staffId || !projectId || !date || !startTime || !endTime || !discipline) {
      return NextResponse.json({ error: 'staffId, projectId, date, startTime, endTime and discipline are required' }, { status: 400 });
    }
    if (!isSkillDiscipline(discipline)) {
      return NextResponse.json({ error: 'Invalid discipline' }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return NextResponse.json({ error: 'Times must be in HH:MM format' }, { status: 400 });
    }

    const [staff, project] = await Promise.all([
      prisma.staff.findUnique({ where: { id: staffId }, select: { id: true, skills: true } }),
      prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }),
    ]);
    if (!staff) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Pay is priced from the staff member's trained level in this discipline, snapshotted now so a
    // later rate-card or skill-level change never rewrites a past shift's pay. If they aren't
    // trained in it yet, an admin has to supply a rate by hand rather than the system guessing one.
    const cardRate = staffHourlyRateFor(staff.skills as unknown as StaffSkill[] | null, discipline);
    const hourlyRate = cardRate ?? (Number(rateOverride) > 0 ? Number(rateOverride) : null);
    if (!hourlyRate) {
      return NextResponse.json(
        { error: `This staff member has no trained ${discipline} skill level. Set one on their profile, or provide a rate for this shift.` },
        { status: 400 }
      );
    }

    const breakMins = Math.max(0, Math.min(720, Number(breakMinutes) || 0));
    const totalHours = computeShiftHours({ startTime, endTime, breakMinutes: breakMins });
    if (totalHours <= 0) {
      return NextResponse.json({ error: 'End time must be after start time (after the break is subtracted)' }, { status: 400 });
    }

    const timesheet = await prisma.timesheet.create({
      data: {
        staffId,
        projectId,
        date: new Date(date),
        startTime,
        endTime,
        breakMinutes: breakMins,
        totalHours,
        discipline,
        hourlyRate,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : null,
      },
      include: {
        staff: { select: { id: true, name: true } },
        project: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ timesheet }, { status: 201 });
  } catch (error) {
    console.error('Create timesheet error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
