import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { defaultPaymentConfig } from '@/lib/payment-config';
import { generatePayNowPayload, generatePayNowQRDataURL } from '@/lib/sgqr';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

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

  // Generate dynamic Singapore EMVCo PayNow SGQR Code
  let sgqrPayload = '';
  let sgqrDataUrl = '';

  try {
    // Generate for remaining balance if not paid, or total amount
    const qrAmount = invoice.balanceDue > 0 ? invoice.balanceDue : invoice.totalAmount;
    const qrOptions = {
      uen: defaultPaymentConfig.uen,
      amount: qrAmount,
      reference: invoice.invoiceNumber,
      merchantName: defaultPaymentConfig.companyName,
      isEditable: false,
    };

    sgqrPayload = generatePayNowPayload(qrOptions);
    sgqrDataUrl = await generatePayNowQRDataURL(qrOptions);
  } catch (err) {
    console.error('Failed to generate SGQR:', err);
  }

  return NextResponse.json({
    invoice,
    paymentConfig: defaultPaymentConfig,
    sgqr: {
      payload: sgqrPayload,
      dataUrl: sgqrDataUrl,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { status, dueDate, paymentMethod, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (notes !== undefined) updateData.notes = notes || null;

    const invoice = await prisma.invoice.update({
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

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Update invoice error:', error);
    return NextResponse.json({ error: 'Invoice not found or update failed' }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

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

    if (!force && (invoice.status === 'PAID' || invoice.paidAmount > 0)) {
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
