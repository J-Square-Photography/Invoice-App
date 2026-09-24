import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'projects') && !hasPermission(user, 'staff')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const assignments = await prisma.projectAssignment.findMany({
    where: { projectId: id },
    include: { staff: { select: { id: true, name: true, type: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ assignments });
}

/** Assigns one staff member to this project. Call once per staff member (the "multi-select" in the
 * UI just loops this), rather than replacing the whole list, so assigning doesn't race with someone
 * else's edit. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'projects')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { staffId, role } = body;
    if (!staffId || typeof staffId !== 'string') {
      return NextResponse.json({ error: 'staffId is required' }, { status: 400 });
    }

    const [project, staff] = await Promise.all([
      prisma.project.findUnique({ where: { id }, select: { id: true } }),
      prisma.staff.findUnique({ where: { id: staffId }, select: { id: true } }),
    ]);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!staff) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });

    const assignment = await prisma.projectAssignment.upsert({
      where: { projectId_staffId: { projectId: id, staffId } },
      create: { projectId: id, staffId, role: typeof role === 'string' && role.trim() ? role.trim().slice(0, 120) : null },
      update: { role: typeof role === 'string' && role.trim() ? role.trim().slice(0, 120) : null },
      include: { staff: { select: { id: true, name: true, type: true, role: true } } },
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    console.error('Assign staff error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
