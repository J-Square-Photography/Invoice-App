import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { parseStoredDiscounts } from '@/lib/invoice-calculations';
import { createDraftInvoice } from '@/lib/create-invoice';

/**
 * Copies an invoice into a new DRAFT for the same project: same line items, discounts,
 * GST setting, payment method and notes, with a fresh number, today's date and a due date
 * 14 days out. No payments, contract or frozen payment details are carried over.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;

  try {
    const source = await prisma.invoice.findUnique({ where: { id }, include: { items: true } });
    if (!source) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const due = new Date();
    due.setDate(due.getDate() + 14);

    const invoice = await createDraftInvoice({
      projectId: source.projectId,
      dueDate: due,
      paymentMethod: source.paymentMethod,
      isGstApplied: source.isGstApplied,
      gstRate: source.gstRate,
      notes: source.notes,
      internalNotes: `Duplicated from invoice ${source.invoiceNumber}.`,
      items: source.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        amount: Number(i.amount),
      })),
      discounts: parseStoredDiscounts(source.discounts),
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Duplicate invoice error:', error);
    return NextResponse.json({ error: 'Failed to duplicate invoice' }, { status: 500 });
  }
}
