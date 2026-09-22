import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

/** Typed by the user in the confirmation pop-up before anything is deleted. */
const CONFIRMATION_WORD = 'DELETE';

async function requireDeveloper() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }
  if (user.role !== ROLES.SUPER_ADMIN) {
    return { error: NextResponse.json({ error: 'Forbidden. Developer role only.' }, { status: 403 }) };
  }
  return { user };
}

/** How much data a reset would delete, shown in the confirmation pop-up. */
export async function GET() {
  const auth = await requireDeveloper();
  if (auth.error) return auth.error;

  const [clients, projects, invoices, payments, contracts, signatures] = await Promise.all([
    prisma.client.count(),
    prisma.project.count(),
    prisma.invoice.count(),
    prisma.paymentLog.count(),
    prisma.contract.count(),
    prisma.signatureAudit.count(),
  ]);

  return NextResponse.json({ counts: { clients, projects, invoices, payments, contracts, signatures } });
}

/**
 * Wipes business data (invoices, payments, contracts, e-signature audit trail and
 * optionally clients and projects) to start from a blank slate. Team accounts are
 * never touched.
 */
export async function POST(request: NextRequest) {
  const auth = await requireDeveloper();
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    if (body.confirm !== CONFIRMATION_WORD) {
      return NextResponse.json(
        { error: `Type ${CONFIRMATION_WORD} to confirm.` },
        { status: 400 }
      );
    }
    const includeClients = body.includeClients === true;

    // Children first, so this works whether or not the database cascades deletes
    const deleted = await prisma.$transaction(async (tx) => {
      const signatures = (await tx.signatureAudit.deleteMany()).count;
      const contracts = (await tx.contract.deleteMany()).count;
      const payments = (await tx.paymentLog.deleteMany()).count;
      await tx.paymentReversal.deleteMany();
      await tx.quoteItem.deleteMany();
      const quotes = (await tx.quote.deleteMany()).count;
      await tx.invoiceItem.deleteMany();
      const invoices = (await tx.invoice.deleteMany()).count;
      let projects = 0;
      let clients = 0;
      if (includeClients) {
        projects = (await tx.project.deleteMany()).count;
        clients = (await tx.client.deleteMany()).count;
      }
      return { signatures, contracts, payments, invoices, quotes, projects, clients };
    });

    console.warn(
      `Data reset by ${auth.user.email}: ${JSON.stringify(deleted)} (includeClients=${includeClients})`
    );

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Reset data error:', error);
    return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 });
  }
}
