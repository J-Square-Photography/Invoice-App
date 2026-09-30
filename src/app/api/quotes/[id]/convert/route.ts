import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { parseStoredDiscounts } from '@/lib/invoice-calculations';
import { createDraftInvoice } from '@/lib/create-invoice';
import { convertQuoteNumberToInvoiceNumber } from '@/lib/invoice-number';
import { defaultInvoiceDueDateObject } from '@/lib/time';
import { logActivity } from '@/lib/activity-log';

/**
 * One-click "convert to invoice": creates a DRAFT invoice with the same line items,
 * discounts, GST and notes (due 1 month after event or 1 month from today), marks the quotation Accepted and links the two.
 * A quotation can only be converted once.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;

  try {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        items: true,
        invoice: { select: { id: true, invoiceNumber: true } },
        project: { select: { shootDate: true } },
      },
    });
    if (!quote) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });

    if (quote.invoice) {
      return NextResponse.json(
        { error: `Already converted to invoice ${quote.invoice.invoiceNumber}.`, invoice: quote.invoice },
        { status: 409 }
      );
    }
    if (quote.status === 'DECLINED') {
      return NextResponse.json({ error: 'A declined quotation cannot be converted. Mark it Sent or Draft first.' }, { status: 409 });
    }

    const due = defaultInvoiceDueDateObject(quote.project?.shootDate);
    const convertedInvoiceNumber = convertQuoteNumberToInvoiceNumber(quote.quoteNumber);

    const invoice = await createDraftInvoice({
      projectId: quote.projectId,
      invoiceNumber: convertedInvoiceNumber,
      dueDate: due,
      paymentMethod: 'PAYNOW_QR',
      isGstApplied: quote.isGstApplied,
      gstRate: quote.gstRate,
      notes: quote.notes,
      internalNotes: `Converted from quotation ${quote.quoteNumber}.`,
      items: quote.items.map((i) => ({ description: i.description, quantity: i.quantity, amount: Number(i.amount) })),
      discounts: parseStoredDiscounts(quote.discounts),
    });

    // Link only if nobody else converted it in the meantime
    const linked = await prisma.quote.updateMany({
      where: { id, invoiceId: null },
      data: { invoiceId: invoice.id, status: 'ACCEPTED' },
    });
    if (linked.count === 0) {
      await prisma.invoice.delete({ where: { id: invoice.id } });
      return NextResponse.json({ error: 'This quotation was just converted by someone else.' }, { status: 409 });
    }

    // A confirmed job is booked
    await prisma.project.updateMany({
      where: { id: quote.projectId, pipelineStatus: { in: ['INQUIRY', 'QUOTED'] } },
      data: { pipelineStatus: 'BOOKED' },
    });

    await logActivity({
      user,
      action: 'CONVERT',
      entityType: 'QUOTE',
      entityId: quote.id,
      entityLabel: quote.quoteNumber,
      description: `Converted quotation ${quote.quoteNumber} to invoice ${invoice.invoiceNumber}.`,
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Convert quote error:', error);
    return NextResponse.json({ error: 'Failed to convert quotation' }, { status: 500 });
  }
}
