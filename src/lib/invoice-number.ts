import { randomInt } from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Document numbers look like INV-2026-873251 / QUO-2026-873251: series, year, then a random 5-digit code
 * followed directly by a running counter (1, 2, ... 10, 11 - no padding). Every calendar month
 * (Singapore time) gets a fresh random 5-digit code, shared by that month's invoices (INV) and
 * quotations (QUO), and each series' counter starts again at 1. The code is created by the first
 * document of the month, so no scheduled job is needed to roll it over.
 */
export type NumberSeriesPrefix = 'INV' | 'QUO' | 'JSQ';

export function randomInvoiceCode(): string {
  return String(randomInt(10_000, 100_000));
}

export const formatInvoiceNumber = (year: number, code: string, seq: number, series: NumberSeriesPrefix = 'INV') =>
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
  const seqField = series === 'QUO' ? 'quoteSeq' : 'invoiceSeq';

  for (let attempt = 0; ; attempt++) {
    try {
      // One atomic increment, so two documents created at the same moment never share a counter
      const row = await prisma.numberSeries.upsert({
        where: { id },
        create: { id, code: randomInvoiceCode(), [seqField]: 1 },
        update: { [seqField]: { increment: 1 } },
      });
      const candidate = formatInvoiceNumber(year, row.code, row[seqField], series);

      // Avoid clashing with any existing records (e.g. invoices converted from quotations)
      if (series === 'INV' || series === 'JSQ') {
        const exists = await prisma.invoice.findUnique({
          where: { invoiceNumber: candidate },
          select: { id: true },
        });
        if (exists) continue;
      } else if (series === 'QUO') {
        const exists = await prisma.quote.findUnique({
          where: { quoteNumber: candidate },
          select: { id: true },
        });
        if (exists) continue;
      }

      return candidate;
    } catch (error) {
      // Two "first of the month" documents raced to create the row: the retry takes the update path
      if (attempt < 5 && isInvoiceNumberClash(error)) continue;
      throw error;
    }
  }
}

export async function generateInvoiceNumber(date = new Date()): Promise<string> {
  return nextDocumentNumber('INV', date);
}

export async function generateQuoteNumber(date = new Date()): Promise<string> {
  return nextDocumentNumber('QUO', date);
}

/**
 * Converts a quotation number to an invoice number by replacing the QUO prefix with INV.
 * E.g. QUO-2026-873251 -> INV-2026-873251
 * E.g. #QUO-2026-873251 -> #INV-2026-873251
 */
export function convertQuoteNumberToInvoiceNumber(quoteNumber: string): string {
  if (quoteNumber.startsWith('QUO-')) {
    return quoteNumber.replace(/^QUO-/, 'INV-');
  }
  if (quoteNumber.startsWith('#QUO-')) {
    return quoteNumber.replace(/^#QUO-/, '#INV-');
  }
  return `INV-${quoteNumber}`;
}

/** True when a create failed on a unique constraint (e.g. an invoice number that already exists). */
export function isInvoiceNumberClash(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

