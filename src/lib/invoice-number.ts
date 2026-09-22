import { prisma } from '@/lib/prisma';

/**
 * Invoice numbers look like JSQ-2026-0007. The next one is the highest existing number
 * for that year plus one. (Counting invoices instead would hand out a number that already
 * exists as soon as any invoice has been deleted.)
 */
export function nextInvoiceSequence(existingNumbers: string[], year: number, series = 'JSQ'): number {
  const prefix = `${series}-${year}-`;
  let max = 0;
  for (const n of existingNumbers) {
    if (!n.startsWith(prefix)) continue;
    const seq = parseInt(n.slice(prefix.length), 10);
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return max + 1;
}

export const formatInvoiceNumber = (year: number, seq: number, series = 'JSQ') => `${series}-${year}-${String(seq).padStart(4, '0')}`;

export async function generateInvoiceNumber(year = new Date().getFullYear()): Promise<string> {
  const rows = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: `JSQ-${year}-` } },
    select: { invoiceNumber: true },
  });
  return formatInvoiceNumber(year, nextInvoiceSequence(rows.map((r) => r.invoiceNumber), year));
}

/** True when a create failed only because another request took the same invoice number a moment earlier. */
export function isInvoiceNumberClash(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}
