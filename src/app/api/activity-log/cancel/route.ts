import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logActivity, isActivityEntityType } from '@/lib/activity-log';

/**
 * Reports a create dialog closed without saving (e.g. "opened Add Staff, closed it without
 * saving"). Any authenticated user can report their own cancelled action; there is nothing
 * sensitive in a description of something that was never created.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const entityType = body?.entityType;
  const description = typeof body?.description === 'string' ? body.description.slice(0, 300) : '';

  if (!isActivityEntityType(entityType) || !description) {
    return NextResponse.json({ error: 'Invalid entityType or description' }, { status: 400 });
  }

  await logActivity({ user, action: 'CANCEL', entityType, description });
  return NextResponse.json({ success: true });
}
