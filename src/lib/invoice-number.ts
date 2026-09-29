import { randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Document numbers look like JSQ-2026-4821371: series, year, then a random 6-digit code
 * followed directly by a running counter (1, 2, ... 10, 11 - no padding). Every calendar month
 * (Singapore time) gets a fresh random code, shared by that month's invoices (JSQ) and
 * quotations (QUO), and each series' counter starts again at 1. The code is created by the first
 * document of the month, so no scheduled job is needed to roll it over.
 */
export type NumberSeriesPrefix = 'JSQ' | 'QUO';

export function randomInvoiceCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export const formatInvoiceNumber = (year: number, code: string, seq: number, series: NumberSeriesPrefix = 'JSQ') =>
  `${series}-${year}-${code}${seq}`;

/** The year and month in Singapore, where the studio works - the server itself runs in UTC. */
export function singaporeYearMonth(date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Singapore', year: 'numeric', month: 'numeric' }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month') };
}

/** Takes the next number in a series for the current month, creating the month's code on first use. */
export async function nextDocumentNumber(series: NumberSeriesPrefix, date = new Date()): Promise<string> {
  const { year, month } = singaporeYearMonth(date);
  const id = `${year}-${String(month).padStart(2, '0')}`;
  const seqField = series === 'JSQ' ? 'invoiceSeq' : 'quoteSeq';

  for (let attempt = 0; ; attempt++) {
    try {
      // One atomic increment, so two documents created at the same moment never share a counter
      const row = await prisma.numberSeries.upsert({
        where: { id },
        create: { id, code: randomInvoiceCode(), [seqField]: 1 },
        update: { [seqField]: { increment: 1 } },
      });
      return formatInvoiceNumber(year, row.code, row[seqField], series);
    } catch (error) {
      // Two "first of the month" documents raced to create the row: the retry takes the update path
      if (attempt < 1 && isInvoiceNumberClash(error)) continue;
      throw error;
    }
  }
}

export async function generateInvoiceNumber(date = new Date()): Promise<string> {
  return nextDocumentNumber('JSQ', date);
}

/** True when a create failed on a unique constraint (e.g. an invoice number that already exists). */
export function isInvoiceNumberClash(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}
