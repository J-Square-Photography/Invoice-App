import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { PHOTOBOOTH_SKILL_CATEGORY_NAME } from '@/lib/staff-rate-card';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const category = await prisma.skillCategory.findUnique({ where: { id } });
    if (!category) return NextResponse.json({ error: 'Skill category not found' }, { status: 404 });
    if (category.name.trim().toLowerCase() === PHOTOBOOTH_SKILL_CATEGORY_NAME.toLowerCase()) {
      return NextResponse.json({ error: `"${PHOTOBOOTH_SKILL_CATEGORY_NAME}" is one of the studio's main skills and can't be deleted.` }, { status: 409 });
    }
    await prisma.skillCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete skill category error:', error);
    return NextResponse.json({ error: 'Skill category not found' }, { status: 404 });
  }
}
