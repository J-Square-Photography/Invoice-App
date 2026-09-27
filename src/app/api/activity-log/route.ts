import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES } from '@/lib/activity-log';

const PAGE_SIZE = 50;

/** Administration > Logs is Developer-only, same as Team - it can show who did what to whom. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== ROLES.SUPER_ADMIN) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const entityType = searchParams.get('entityType');
  const userName = searchParams.get('userName');
  const q = searchParams.get('q');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const where: Record<string, unknown> = {};
  if (action && (ACTIVITY_ACTIONS as readonly string[]).includes(action)) where.action = action;
  if (entityType && (ACTIVITY_ENTITIES as readonly string[]).includes(entityType)) where.entityType = entityType;
  if (userName) where.userName = { contains: userName, mode: 'insensitive' };
  if (q) {
    where.OR = [
      { description: { contains: q, mode: 'insensitive' } },
      { entityLabel: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pageSize: PAGE_SIZE });
}
