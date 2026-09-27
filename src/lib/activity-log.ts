import { prisma } from '@/lib/prisma';
import { type ActivityAction, type ActivityEntityType } from '@/lib/activity-log-types';

export { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES, isActivityEntityType } from '@/lib/activity-log-types';
export type { ActivityAction, ActivityEntityType } from '@/lib/activity-log-types';

interface LogActivityInput {
  user: { userId: string; name?: string | null; email: string };
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  description: string;
}

/**
 * Records one line in the admin-wide audit trail (Administration > Logs, Developer-only).
 * Never throws - a logging failure must never break the action it is describing.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.user.userId,
        userName: input.user.name || input.user.email,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        description: input.description,
      },
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}
