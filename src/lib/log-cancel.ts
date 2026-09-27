'use client';

import type { ActivityEntityType } from '@/lib/activity-log-types';

/**
 * Fire-and-forget report that a create dialog was closed without saving. `keepalive` lets the
 * request survive the dialog/page unmounting right after, and failures are swallowed - a missed
 * audit-log line must never surface as an error to the person just trying to close a dialog.
 */
export function logCancelledAction(entityType: ActivityEntityType, description: string): void {
  fetch('/api/activity-log/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entityType, description }),
    keepalive: true,
  }).catch(() => {});
}
