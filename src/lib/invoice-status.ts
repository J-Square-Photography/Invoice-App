/** Money is compared in whole cents so floating point drift can never decide a status. */
export function toCents(value: number | string): number {
  return Math.round((Number(value) + Number.EPSILON) * 100);
}

/**
 * The status an invoice must have given what has been paid. Status follows the
 * payments, not the other way round:
 *  - any payment and nothing left to pay -> PAID
 *  - any payment and something left      -> PARTIAL
 *  - no payments                         -> stays DRAFT/SENT (a leftover PARTIAL/PAID reopens as SENT)
 *  - VOID always stays VOID
 */
export function deriveStatus(currentStatus: string, paidAmount: number | string, totalAmount: number | string): string {
  if (currentStatus === 'VOID') return 'VOID';
  const paid = toCents(paidAmount);
  const total = toCents(totalAmount);
  if (paid > 0) return paid >= total ? 'PAID' : 'PARTIAL';
  return currentStatus === 'PARTIAL' || currentStatus === 'PAID' ? 'SENT' : currentStatus;
}

/** Statuses a person may choose by hand. PARTIAL and PAID are only ever set by payments. */
export const MANUAL_STATUSES = ['DRAFT', 'SENT', 'VOID'] as const;

/**
 * An invoice is overdue when it has been sent (fully or partly unpaid) and its due date
 * was before today. Drafts, paid and void invoices are never overdue.
 */
export function isOverdue(status: string, dueDate: string | Date, now: Date = new Date()): boolean {
  if (status !== 'SENT' && status !== 'PARTIAL') return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return new Date(dueDate) < startOfToday;
}
