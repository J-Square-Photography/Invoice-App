import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { calculateInvoiceTotals, parseStoredDiscounts } from '@/lib/invoice-calculations';
import { isQuoteStatus } from '@/lib/quote-status';
import { Prisma } from '@prisma/client';
import { logActivity } from '@/lib/activity-log';

const quoteInclude = {
  project: { include: { client: true } },
  items: true,
  invoice: { select: { id: true, invoiceNumber: true, status: true } },
} as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'quotes')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const quote = await prisma.quote.findUnique({ where: { id }, include: quoteInclude });
  if (!quote) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
  return NextResponse.json({ quote });
}

/** Edit a quotation, or move it between Draft / Sent / Accepted / Declined. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'quotes')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.quote.findUnique({ where: { id }, include: { items: true } });
    if (!existing) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });

    const body = await request.json();
    const { projectId, validUntil, isGstApplied, gstRate, notes, items, discounts, status, deposit, depositAmount } = body;

    // Once converted, the quotation is a record of what was quoted
    if (existing.invoiceId) {
      return NextResponse.json(
        { error: 'This quotation has been converted to an invoice, so it is locked. Edit the invoice instead.' },
        { status: 409 }
      );
    }

    const data: Prisma.QuoteUncheckedUpdateInput = {};

    if (status !== undefined) {
      if (!isQuoteStatus(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      data.status = status;
    }
    if (validUntil !== undefined) {
      const d = new Date(validUntil);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid valid-until date' }, { status: 400 });
      data.validUntil = d;
    }
    if (notes !== undefined) data.notes = notes || null;
    if (projectId !== undefined && projectId !== existing.projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      data.projectId = projectId;
    }

    // Any change to the priced content re-runs the shared calculation
    const repricing = items !== undefined || discounts !== undefined || isGstApplied !== undefined || gstRate !== undefined || deposit !== undefined || depositAmount !== undefined;
    let newItems: ReturnType<typeof calculateInvoiceTotals>['items'] | null = null;
    if (repricing) {
      const rawItems =
        items !== undefined
          ? items
          : existing.items.map((i) => ({ description: i.description, quantity: i.quantity, amount: Number(i.amount) }));
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
      }
      const gst = isGstApplied ?? existing.isGstApplied;
      const depositVal = deposit !== undefined ? deposit : depositAmount !== undefined ? depositAmount : existing.depositAmount;
      const totals = calculateInvoiceTotals(rawItems, {
        isGstApplied: gst,
        gstRate: gstRate ?? existing.gstRate,
        discounts: Array.isArray(discounts) ? discounts : discounts === undefined ? parseStoredDiscounts(existing.discounts) : [],
        deposit: depositVal,
      });
      data.subtotal = totals.subtotal;
      data.discountAmount = totals.discountAmount;
      data.discounts = totals.discounts.length > 0 ? (totals.discounts as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
      data.depositAmount = totals.depositAmount;
      data.isGstApplied = gst;
      data.gstRate = totals.gstRate;
      data.gstAmount = totals.gstAmount;
      data.totalAmount = totals.totalAmount;
      newItems = totals.items;
    }

    if (Object.keys(data).length === 0 && !newItems) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const quote = await prisma.$transaction(async (tx) => {
      if (newItems) {
        await tx.quoteItem.deleteMany({ where: { quoteId: id } });
        await tx.quoteItem.createMany({ data: newItems.map((i) => ({ ...i, quoteId: id })) });
      }
      return tx.quote.update({ where: { id }, data, include: quoteInclude });
    });

    // Sending a quotation moves an enquiry on to "Quoted"
    if (data.status === 'SENT') {
      await prisma.project.updateMany({
        where: { id: quote.projectId, pipelineStatus: 'INQUIRY' },
        data: { pipelineStatus: 'QUOTED' },
      });
    }

    await logActivity({
      user,
      action: 'UPDATE',
      entityType: 'QUOTE',
      entityId: quote.id,
      entityLabel: quote.quoteNumber,
      description: `Updated quotation ${quote.quoteNumber}.`,
    });

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('Update quote error:', error);
    return NextResponse.json({ error: 'Failed to update quotation' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'quotes')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  try {
    const deleted = await prisma.quote.delete({ where: { id } });
    await logActivity({
      user,
      action: 'DELETE',
      entityType: 'QUOTE',
      entityId: id,
      entityLabel: deleted.quoteNumber,
      description: `Deleted quotation ${deleted.quoteNumber}.`,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
  }
}
