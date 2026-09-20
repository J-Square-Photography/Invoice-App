import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      amountPaid,
      paymentDate = new Date().toISOString(),
      paymentMethod = 'PAYNOW_QR',
      transactionRef,
      notes,
    } = body;

    const parsedAmount = parseFloat(amountPaid);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid payment amount greater than zero is required' },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'VOID') {
      return NextResponse.json(
        { error: 'Cannot record payments on a VOID invoice' },
        { status: 400 }
      );
    }

    if (parsedAmount > invoice.balanceDue + 0.01) {
      return NextResponse.json(
        {
          error: `Payment of $${parsedAmount.toFixed(2)} exceeds the outstanding balance of $${invoice.balanceDue.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // Calculate new paid amount and balance due
    const newPaidAmount = Math.round((invoice.paidAmount + parsedAmount) * 100) / 100;
    const newBalanceDue = Math.max(0, Math.round((invoice.totalAmount - newPaidAmount) * 100) / 100);

    // Automated state transition:
    // If balance is 0 or less -> PAID
    // Else if some amount has been paid -> PARTIAL
    // Else keep current
    let newStatus = invoice.status;
    if (newBalanceDue <= 0.001) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIAL';
    }

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // 1. Create payment log
      await tx.paymentLog.create({
        data: {
          invoiceId: id,
          amountPaid: parsedAmount,
          paymentDate: new Date(paymentDate),
          paymentMethod,
          transactionRef: transactionRef || null,
          notes: notes || null,
          recordedBy: user.name || user.email,
        },
      });

      // 2. Update invoice balances and status
      const res = await tx.invoice.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          balanceDue: newBalanceDue,
          status: newStatus,
        },
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

      return res;
    });

    return NextResponse.json({
      invoice: updatedInvoice,
      message: `Payment of SGD $${parsedAmount.toFixed(2)} recorded successfully.`,
    });
  } catch (error) {
    console.error('Record payment error:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
