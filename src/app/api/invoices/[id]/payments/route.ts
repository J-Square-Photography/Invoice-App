import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getCompanySettings } from '@/lib/company-settings';
import { makeSnapshot, parseSnapshot, snapshotForDb } from '@/lib/payment-snapshot';
import { deriveStatus, toCents } from '@/lib/invoice-status';
import { parseProofDataUrl, hasPaymentEvidence, getStorageStatus } from '@/lib/payment-proof';
import { ROLES } from '@/lib/constants';
import { usesSamplePaymentDetails } from '@/lib/payment-config';

class PaymentRejected extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

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
      proofImage,
    } = body;

    const parsedAmount = parseFloat(amountPaid);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Valid payment amount greater than zero is required' },
        { status: 400 }
      );
    }
    const amountCents = toCents(parsedAmount);
    if (amountCents <= 0) {
      return NextResponse.json({ error: 'Payment amount must be at least SGD 0.01' }, { status: 400 });
    }

    // Proof of payment: a shrunk screenshot, and/or the bank reference. One of them is required.
    let proof: { mime: string; data: Buffer } | null = null;
    if (proofImage) {
      const parsed = parseProofDataUrl(proofImage);
      if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const storage = await getStorageStatus().catch(() => null);
      if (storage?.level === 'full') {
        return NextResponse.json(
          { error: 'Storage is nearly full, so new proof images are paused. Record the payment with the bank reference instead, and archive old proofs.' },
          { status: 507 }
        );
      }
      proof = parsed;
    }
    if (!hasPaymentEvidence({ hasProof: !!proof, reference: transactionRef, notes, method: paymentMethod })) {
      return NextResponse.json(
        { error: 'Add proof that the money arrived: attach a screenshot of the payment, or enter the bank reference (for cash or cheque, a receipt note).' },
        { status: 400 }
      );
    }
    // A Developer checking their own entry counts as verified; a Manager's entry waits for a Developer to verify it
    const selfVerified = user.role === ROLES.SUPER_ADMIN;

    // Read live settings before the transaction (only used if this is the first payment)
    const live = await getCompanySettings();

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      // Re-read inside the transaction so two quick payments can't both pass the balance check
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice) throw new PaymentRejected('Invoice not found', 404);
      if (invoice.status === 'VOID') throw new PaymentRejected('Cannot record payments on a VOID invoice');

      const totalCents = toCents(invoice.totalAmount);
      const paidCents = toCents(invoice.paidAmount);
      const remainingCents = totalCents - paidCents;

      if (remainingCents <= 0) {
        throw new PaymentRejected('This invoice is already paid in full.', 409);
      }
      // Never accept more than what is still owed, not even by a cent
      if (amountCents > remainingCents) {
        throw new PaymentRejected(
          `Payment of $${(amountCents / 100).toFixed(2)} is more than the outstanding balance. The most you can record is $${(remainingCents / 100).toFixed(2)}.`
        );
      }

      const newPaid = (paidCents + amountCents) / 100;
      const newBalance = (totalCents - paidCents - amountCents) / 100;
      // Paid in full is marked PAID (and locked) automatically; otherwise PARTIAL
      const newStatus = deriveStatus(invoice.status, newPaid, invoice.totalAmount);

      await tx.paymentLog.create({
        data: {
          invoiceId: id,
          amountPaid: amountCents / 100,
          paymentDate: new Date(paymentDate),
          paymentMethod,
          transactionRef: transactionRef?.toString().trim() || null,
          notes: notes || null,
          recordedBy: user.name || user.email,
          proofBytes: proof ? proof.data.length : null,
          ...(proof ? { proof: { create: { mime: proof.mime, data: proof.data } } } : {}),
          ...(selfVerified ? { verifiedAt: new Date(), verifiedBy: user.name || user.email } : {}),
        },
      });

      // The first payment freezes the payment details the client was given
      const freezeDetails = !parseSnapshot(invoice.paymentSnapshot) && !usesSamplePaymentDetails(live)
        ? snapshotForDb(makeSnapshot(live, invoice.paymentMethod))
        : undefined;

      return tx.invoice.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          balanceDue: newBalance,
          status: newStatus,
          ...(freezeDetails ? { paymentSnapshot: freezeDetails } : {}),
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
    });

    return NextResponse.json({
      invoice: updatedInvoice,
      message:
        updatedInvoice.status === 'PAID'
          ? `Payment of SGD $${parsedAmount.toFixed(2)} recorded. Invoice is now paid in full and locked.`
          : `Payment of SGD $${parsedAmount.toFixed(2)} recorded successfully.`,
    });
  } catch (error) {
    if (error instanceof PaymentRejected) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Record payment error:', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}
