/**
 * Appends a dated, admin-only line to an invoice's internal notes - a running log of
 * bookkeeping-relevant events (voided, payment reverted, duplicated, ...). Never shown to
 * the client or printed on any PDF. Earlier entries are kept, not overwritten.
 */
export function appendInternalNote(existing: string | null | undefined, note: string): string {
  const stamp = new Date().toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' });
  const entry = `[${stamp}] ${note}`;
  return existing ? `${existing}\n${entry}` : entry;
}
