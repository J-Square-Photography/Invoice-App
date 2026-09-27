import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { Prisma } from '@prisma/client';
import { defaultPaymentConfig, usesSamplePaymentDetails, SAMPLE_DETAILS_MESSAGE } from '@/lib/payment-config';
import { getCompanySettings, toPublicPaymentConfig } from '@/lib/company-settings';
import { makeSnapshot, parseSnapshot, resolveCompany, snapshotForDb } from '@/lib/payment-snapshot';
import { MANUAL_STATUSES, deriveStatus, toCents } from '@/lib/invoice-status';
import { generatePayNowPayload, generatePayNowQRDataURL } from '@/lib/sgqr';
import {
  calculateInvoiceTotals,
  parseStoredDiscounts,
  roundCents,
  type ProcessedInvoiceItem,
  type RawInvoiceItemInput,
} from '@/lib/invoice-calculations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'invoices')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      project: {
        include: { client: true },
      },
      items: true,
      paymentLogs: {
        orderBy: { paymentDate: 'desc' },
      },
      contract: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // A sent invoice shows the details it was issued with; a draft follows Settings
  const company = resolveCompany(invoice, await getCompanySettings());

  // 'dynamic': generated SGQR for this invoice; 'static': the uploaded QR image;
  // 'static-missing': invoice wants a static QR but none has been uploaded yet.
  let mode: 'dynamic' | 'static' | 'static-missing' = 'dynamic';
  let sgqrPayload = '';
  let sgqrDataUrl = '';

  if (invoice.paymentMethod === 'PAYNOW_STATIC_QR') {
    if (company.staticQrDataUrl) {
      mode = 'static';
      sgqrDataUrl = company.staticQrDataUrl;
    } else {
      mode = 'static-missing';
    }
  } else {
    try {
      // Generate for remaining balance if not paid, or total amount
      const qrAmount = invoice.balanceDue > 0 ? invoice.balanceDue : invoice.totalAmount;
      const qrOptions = {
        uen: company.uen,
        amount: qrAmount,
        reference: invoice.invoiceNumber,
        merchantName: company.companyName,
        isEditable: false,
      };

      sgqrPayload = generatePayNowPayload(qrOptions);
      sgqrDataUrl = await generatePayNowQRDataURL(qrOptions);
    } catch (err) {
      console.error('Failed to generate SGQR:', err);
    }
  }

  return NextResponse.json({
    invoice,
    paymentConfig: toPublicPaymentConfig(company),
    paymentDetailsFrozen: company.frozen,
    sgqr: {
      payload: sgqrPayload,
      dataUrl: sgqrDataUrl,
      mode,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'invoices')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { status, dueDate, paymentMethod, notes, internalNotes, items, isGstApplied, gstRate, projectId, discounts } = body;

    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: { contract: { select: { id: true } }, items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (existing.status === 'PAID') {
      return NextResponse.json(
        { error: 'Paid invoices are locked. Revert the payment to make changes.' },
        { status: 409 }
      );
    }

    // Status follows the payments: PARTIAL and PAID are only ever set by recording payments
    let unvoidStatus: string | null = null;
    if (status !== undefined) {
      if (!(MANUAL_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json(
          { error: 'Paid and Partial statuses are set automatically when payments are recorded.' },
          { status: 400 }
        );
      }
      if (status !== 'VOID' && toCents(existing.paidAmount) > 0) {
        if (existing.status === 'VOID') {
          // Un-voiding an invoice that has payments: status goes back to what the payments say
          unvoidStatus = deriveStatus('SENT', existing.paidAmount, existing.totalAmount);
        } else {
          return NextResponse.json(
            {
              error:
                'Payments have been recorded on this invoice, so its status follows the payments. Void it, or revert the payments, to change it.',
            },
            { status: 409 }
          );
        }
      }
    }

    const editsAmounts =
      items !== undefined || isGstApplied !== undefined || gstRate !== undefined || discounts !== undefined;
    const changesProject = projectId !== undefined && projectId !== existing.projectId;

    if ((editsAmounts || changesProject) && existing.status === 'VOID') {
      return NextResponse.json(
        { error: 'Void invoices cannot be edited. Change the status first.' },
        { status: 400 }
      );
    }
    if ((editsAmounts || changesProject) && existing.contract) {
      return NextResponse.json(
        {
          error:
            'This invoice already has a contract generated from it. Delete the contract before changing the line items, GST or project.',
        },
        { status: 409 }
      );
    }
    if (changesProject) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = unvoidStatus ?? status;
    if (dueDate !== undefined) {
      const due = new Date(dueDate);
      if (Number.isNaN(due.getTime())) return NextResponse.json({ error: 'Invalid due date' }, { status: 400 });
      updateData.dueDate = due;
    }
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (notes !== undefined) updateData.notes = notes || null;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes || null;
    if (changesProject) updateData.projectId = projectId;

    // Freeze the payment details once the invoice leaves DRAFT, so later changes in
    // Settings can't alter what the client was told to pay to.
    const existingSnapshot = parseSnapshot(existing.paymentSnapshot);
    const leavingDraft = status !== undefined && status !== 'DRAFT' && existing.status === 'DRAFT';
    if (!existingSnapshot && leavingDraft) {
      const live = await getCompanySettings();
      // Sending is what tells the client where to pay, so it needs real details (voiding a draft is fine)
      if (status === 'SENT' && usesSamplePaymentDetails(live)) {
        return NextResponse.json({ error: SAMPLE_DETAILS_MESSAGE }, { status: 409 });
      }
      if (!usesSamplePaymentDetails(live)) {
        updateData.paymentSnapshot = snapshotForDb(makeSnapshot(live, paymentMethod ?? existing.paymentMethod));
      }
    } else if (existingSnapshot && paymentMethod === 'PAYNOW_STATIC_QR' && !existingSnapshot.staticQrDataUrl) {
      // Deliberately switching a sent invoice to the static QR: capture the QR as it is now
      const live = await getCompanySettings();
      updateData.paymentSnapshot = snapshotForDb({ ...existingSnapshot, staticQrDataUrl: live.staticQrDataUrl });
    }

    let replacementItems: ProcessedInvoiceItem[] | null = null;

    if (editsAmounts) {
      const rawItems: RawInvoiceItemInput[] = Array.isArray(items)
        ? items
        : existing.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
          }));

      if (rawItems.length === 0) {
        return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
      }

      const gstOn = isGstApplied ?? existing.isGstApplied;
      const totals = calculateInvoiceTotals(rawItems, {
        isGstApplied: gstOn,
        gstRate: gstRate ?? (existing.gstRate || defaultPaymentConfig.gstRate),
        // Percentage discounts depend on the subtotal, so when only the items change the
        // discounts already on the invoice are re-applied to the new subtotal
        discounts: Array.isArray(discounts) ? discounts : discounts === undefined ? parseStoredDiscounts(existing.discounts) : [],
      });

      const paid = Number(existing.paidAmount);
      if (totals.totalAmount + 0.001 < paid) {
        return NextResponse.json(
          {
            error: `The new total (SGD ${totals.totalAmount.toFixed(2)}) is lower than the amount already paid (SGD ${paid.toFixed(2)}). Adjust the recorded payments first.`,
          },
          { status: 400 }
        );
      }

      const balanceDue = roundCents(totals.totalAmount - paid);
      updateData.subtotal = totals.subtotal;
      updateData.discountAmount = totals.discountAmount;
      updateData.discounts =
        totals.discounts.length > 0 ? (totals.discounts as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
      updateData.isGstApplied = gstOn;
      updateData.gstRate = totals.gstRate;
      updateData.gstAmount = totals.gstAmount;
      updateData.totalAmount = totals.totalAmount;
      updateData.balanceDue = balanceDue;
      replacementItems = totals.items;

      // Keep status consistent with payments when the caller didn't set one explicitly
      if (status === undefined && paid > 0) {
        updateData.status = deriveStatus(existing.status, paid, totals.totalAmount);
      }
    }

    const invoice = await prisma.$transaction(async (tx) => {
      if (replacementItems) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        updateData.items = { create: replacementItems };
      }
      return tx.invoice.update({
        where: { id },
        data: updateData,
        include: {
          project: {
            include: { client: true },
          },
          items: true,
          paymentLogs: {
            orderBy: { paymentDate: 'desc' },
          },
        },
      });
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Update invoice error:', error);
    return NextResponse.json({ error: 'Invoice update failed' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'invoices')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true' || user.role === 'SUPER_ADMIN';

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { paymentLogs: true, contract: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json(
        { error: 'Paid invoices are locked. Revert the payment first, then delete if needed.' },
        { status: 409 }
      );
    }

    if (!force && invoice.paidAmount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete invoice with recorded payments. Mark as VOID or request Super Admin force delete.' },
        { status: 400 }
      );
    }

    // Cascade delete any contract audits and contracts
    if (invoice.contract) {
      await prisma.signatureAudit.deleteMany({
        where: { contractId: invoice.contract.id },
      });
      await prisma.contract.deleteMany({
        where: { invoiceId: id },
      });
    }

    // Cascade delete payment logs and invoice items
    await prisma.paymentLog.deleteMany({ where: { invoiceId: id } });
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });

    await prisma.invoice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return NextResponse.json({ error: 'Delete invoice failed' }, { status: 500 });
  }
}
