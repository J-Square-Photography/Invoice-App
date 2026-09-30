import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateInvoiceTotals, type RawInvoiceItemInput, type RawDiscountInput } from '@/lib/invoice-calculations';
import { nextDocumentNumber, isInvoiceNumberClash } from '@/lib/invoice-number';

export interface NewQuoteInput {
  projectId: string;
  validUntil: string | Date;
  isGstApplied: boolean;
  gstRate: number;
  deposit?: number | string;
  notes?: string | null;
  items: RawInvoiceItemInput[];
  discounts?: RawDiscountInput[];
  status?: 'DRAFT' | 'SENT';
}

/** Quotation numbers look like QUO-2026-4821371: the month's shared code, with their own counter. */
export async function generateQuoteNumber(date = new Date()): Promise<string> {
  return nextDocumentNumber('QUO', date);
}

/** Creates a quotation with its totals worked out by the same calculation invoices use. */
export async function createQuote(input: NewQuoteInput) {
  const totals = calculateInvoiceTotals(input.items, {
    isGstApplied: input.isGstApplied,
    gstRate: input.gstRate,
    discounts: input.discounts ?? [],
    deposit: input.deposit,
  });

  for (let attempt = 0; ; attempt++) {
    const quoteNumber = await generateQuoteNumber();
    try {
      return await prisma.quote.create({
        data: {
          projectId: input.projectId,
          quoteNumber,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          discounts: totals.discounts.length > 0 ? (totals.discounts as unknown as Prisma.InputJsonValue) : undefined,
          depositAmount: totals.depositAmount,
          isGstApplied: input.isGstApplied,
          gstRate: totals.gstRate,
          gstAmount: totals.gstAmount,
          totalAmount: totals.totalAmount,
          validUntil: new Date(input.validUntil),
          status: input.status ?? 'DRAFT',
          notes: input.notes || null,
          items: { create: totals.items },
        },
        include: { project: { include: { client: true } }, items: true },
      });
    } catch (error) {
      if (attempt < 3 && isInvoiceNumberClash(error)) continue;
      throw error;
    }
  }
}
