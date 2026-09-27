import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { logActivity } from '@/lib/activity-log';

/**
 * A Developer confirms they checked the bank and the money really arrived (or clears that
 * confirmation). Body: { verified: boolean } (default true).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (user.role !== ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Only a Developer can verify payments.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const verified = body.verified !== false;

  try {
    const payment = await prisma.paymentLog.update({
      where: { id },
      data: verified ? { verifiedAt: new Date(), verifiedBy: user.name || user.email } : { verifiedAt: null, verifiedBy: null },
      include: { invoice: { select: { invoiceNumber: true } } },
    });
    await logActivity({
      user,
      action: 'VERIFY',
      entityType: 'PAYMENT',
      entityId: payment.id,
      entityLabel: payment.invoice.invoiceNumber,
      description: verified
        ? `Verified a payment of SGD $${Number(payment.amountPaid).toFixed(2)} on invoice ${payment.invoice.invoiceNumber}.`
        : `Cleared verification on a payment on invoice ${payment.invoice.invoiceNumber}.`,
    });
    return NextResponse.json({ payment });
  } catch {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }
}
