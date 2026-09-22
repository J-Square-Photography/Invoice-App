import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/**
 * Reverts a PAID invoice back to an open state: clears its payment ledger,
 * resets the paid amount to zero and puts the full total back as balance due.
 * This is the only way to unlock a paid invoice.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;

  try {
    const existing = await prisma.invoice.findUnique({
      where: { id },
      include: {
        paymentLogs: true,
        project: { select: { client: { select: { companyName: true } } } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    if (existing.status !== 'PAID') {
      return NextResponse.json({ error: 'Only paid invoices can be reverted.' }, { status: 400 });
    }

    const clearedCount = existing.paymentLogs.length;

    const invoice = await prisma.$transaction(async (tx) => {
      // Keep a record of what is being removed and by whom, so the ledger is never silently lost
      if (existing.paymentLogs.length > 0) {
        await tx.paymentReversal.createMany({
          data: existing.paymentLogs.map((p) => ({
            invoiceId: id,
            invoiceNumber: existing.invoiceNumber,
            clientName: existing.project.client.companyName,
            amountPaid: p.amountPaid,
            paymentDate: p.paymentDate,
            paymentMethod: p.paymentMethod,
            transactionRef: p.transactionRef,
            recordedBy: p.recordedBy,
            verifiedBy: p.verifiedBy,
            reversedBy: user.name || user.email,
          })),
        });
      }
      await tx.paymentLog.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          paidAmount: 0,
          balanceDue: existing.totalAmount,
          status: 'SENT',
        },
        include: {
          project: { include: { client: true } },
          items: true,
          paymentLogs: { orderBy: { paymentDate: 'desc' } },
        },
      });
    });

    console.info(
      `Invoice ${existing.invoiceNumber} reverted from PAID by ${user.email}; cleared ${clearedCount} payment record(s).`
    );

    return NextResponse.json({
      invoice,
      message: `Invoice ${existing.invoiceNumber} reverted. ${clearedCount} payment record${clearedCount === 1 ? '' : 's'} cleared.`,
    });
  } catch (error) {
    console.error('Revert invoice error:', error);
    return NextResponse.json({ error: 'Failed to revert invoice' }, { status: 500 });
  }
}
