/** Pure constants/types shared between server routes and client components - no server-only imports here. */

export const ACTIVITY_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'CANCEL',
  'VOID',
  'UNVOID',
  'CONVERT',
  'REVERT',
  'DUPLICATE',
  'VERIFY',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const ACTIVITY_ENTITIES = [
  'STAFF',
  'CLIENT',
  'PROJECT',
  'INVOICE',
  'QUOTE',
  'PAYMENT',
  'USER',
  'CONTRACT',
  'TIMESHEET',
] as const;
export type ActivityEntityType = (typeof ACTIVITY_ENTITIES)[number];

export const isActivityEntityType = (v: unknown): v is ActivityEntityType =>
  typeof v === 'string' && (ACTIVITY_ENTITIES as readonly string[]).includes(v);
