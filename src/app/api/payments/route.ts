import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';
import { hasPermission } from '@/lib/permissions';
import { getStorageStatus } from '@/lib/payment-proof';

/**
 * Every recorded payment across all invoices, for double-checking that money really arrived.
 * Query: month=YYYY-MM (optional), status=unverified|verified|noproof, q=text.
 * Also returns the totals per payment method for the month (the one number to compare with a bank statement).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'payments')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const status = searchParams.get('status');
  const q = (searchParams.get('q') ?? '').trim();

  const where: Record<string, unknown> = { invoice: { status: { not: 'VOID' } } };
  if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    where.paymentDate = { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
  }
  if (status === 'unverified') where.verifiedAt = null;
  if (status === 'verified') where.verifiedAt = { not: null };
  if (status === 'noproof') where.proofBytes = null;
  if (q) {
    where.OR = [
      { transactionRef: { contains: q, mode: 'insensitive' } },
      { invoice: { invoiceNumber: { contains: q, mode: 'insensitive' } } },
      { invoice: { project: { client: { companyName: { contains: q, mode: 'insensitive' } } } } },
    ];
  }

  const payments = await prisma.paymentLog.findMany({
    where,
    orderBy: { paymentDate: 'desc' },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          project: { select: { title: true, client: { select: { companyName: true } } } },
        },
      },
    },
  });

  // Totals for what is on screen, by method, and how many still need checking (across everything)
  const totalsByMethod: Record<string, { count: number; total: number }> = {};
  for (const p of payments) {
    const key = p.paymentMethod || 'OTHER';
    totalsByMethod[key] ??= { count: 0, total: 0 };
    totalsByMethod[key].count += 1;
    totalsByMethod[key].total = Math.round((totalsByMethod[key].total + Number(p.amountPaid)) * 100) / 100;
  }
  const unverifiedCount = await prisma.paymentLog.count({ where: { verifiedAt: null, invoice: { status: { not: 'VOID' } } } });

  const isDeveloper = user.role === ROLES.SUPER_ADMIN;
  const [reversals, storage] = await Promise.all([
    prisma.paymentReversal.findMany({ orderBy: { reversedAt: 'desc' }, take: 20 }),
    isDeveloper ? getStorageStatus().catch(() => null) : Promise.resolve(null),
  ]);

  return NextResponse.json({ payments, totalsByMethod, unverifiedCount, reversals, storage, canVerify: isDeveloper });
}
