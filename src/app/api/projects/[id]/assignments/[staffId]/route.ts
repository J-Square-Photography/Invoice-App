import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; staffId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'projects')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id, staffId } = await params;
  try {
    await prisma.projectAssignment.delete({ where: { projectId_staffId: { projectId: id, staffId } } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unassign staff error:', error);
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }
}
