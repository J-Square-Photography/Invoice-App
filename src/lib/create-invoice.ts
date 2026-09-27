import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateInvoiceTotals, type RawInvoiceItemInput, type RawDiscountInput } from '@/lib/invoice-calculations';
import { generateInvoiceNumber, isInvoiceNumberClash } from '@/lib/invoice-number';

export interface NewInvoiceInput {
  projectId: string;
  dueDate: string | Date;
  paymentMethod: string | null;
  isGstApplied: boolean;
  gstRate: number;
  notes?: string | null;
  /** Admin-only remarks (e.g. "Converted from quotation..."). Never shown to the client or printed on the PDF. */
  internalNotes?: string | null;
  items: RawInvoiceItemInput[];
  discounts?: RawDiscountInput[];
}

/**
 * Creates a DRAFT invoice with its totals worked out by the shared calculation.
 * If two invoices are created at the same moment and pick the same number, the loser
 * simply tries again with the next one.
 */
export async function createDraftInvoice(input: NewInvoiceInput) {
  const totals = calculateInvoiceTotals(input.items, {
    isGstApplied: input.isGstApplied,
    gstRate: input.gstRate,
    discounts: input.discounts ?? [],
  });

  for (let attempt = 0; ; attempt++) {
    const invoiceNumber = await generateInvoiceNumber();
    try {
      return await prisma.invoice.create({
        data: {
          projectId: input.projectId,
          invoiceNumber,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          discounts: totals.discounts.length > 0 ? (totals.discounts as unknown as Prisma.InputJsonValue) : undefined,
          isGstApplied: input.isGstApplied,
          gstRate: totals.gstRate,
          gstAmount: totals.gstAmount,
          totalAmount: totals.totalAmount,
          paidAmount: 0,
          balanceDue: totals.totalAmount,
          issueDate: new Date(),
          dueDate: new Date(input.dueDate),
          status: 'DRAFT',
          paymentMethod: input.paymentMethod,
          notes: input.notes || null,
          internalNotes: input.internalNotes || null,
          items: { create: totals.items },
        },
        include: {
          project: { include: { client: true } },
          items: true,
          paymentLogs: true,
        },
      });
    } catch (error) {
      if (attempt < 3 && isInvoiceNumberClash(error)) continue;
      throw error;
    }
  }
}
