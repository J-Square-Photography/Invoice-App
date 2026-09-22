import { PrismaClient } from '@prisma/client';

// Money columns are stored as Postgres `numeric` (via Prisma `Decimal`) for
// accurate storage, but the rest of the app works with plain JS numbers
// (arithmetic, .toFixed(), JSON responses, PDF generation). This extension
// converts Decimal <-> number at the client boundary so no other file has to
// deal with Decimal objects directly.
// A connection_limit of 1 (a common serverless recommendation) makes pages that
// run several queries at once queue behind a single connection and time out
// (P2024). Enforce a small pool here so it doesn't depend on the env var.
function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    url.searchParams.set('connection_limit', '5');
    url.searchParams.set('pool_timeout', '20');
    return url.toString();
  } catch {
    return raw;
  }
}

function createPrismaClient() {
  const url = databaseUrl();
  const base = url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
  return base.$extends({
    result: {
      invoice: {
        subtotal: { needs: { subtotal: true }, compute: (invoice) => Number(invoice.subtotal) },
        discountAmount: { needs: { discountAmount: true }, compute: (invoice) => Number(invoice.discountAmount) },
        gstAmount: { needs: { gstAmount: true }, compute: (invoice) => Number(invoice.gstAmount) },
        totalAmount: { needs: { totalAmount: true }, compute: (invoice) => Number(invoice.totalAmount) },
        paidAmount: { needs: { paidAmount: true }, compute: (invoice) => Number(invoice.paidAmount) },
        balanceDue: { needs: { balanceDue: true }, compute: (invoice) => Number(invoice.balanceDue) },
      },
      invoiceItem: {
        unitPrice: { needs: { unitPrice: true }, compute: (item) => Number(item.unitPrice) },
        amount: { needs: { amount: true }, compute: (item) => Number(item.amount) },
      },
      quote: {
        subtotal: { needs: { subtotal: true }, compute: (q) => Number(q.subtotal) },
        discountAmount: { needs: { discountAmount: true }, compute: (q) => Number(q.discountAmount) },
        gstAmount: { needs: { gstAmount: true }, compute: (q) => Number(q.gstAmount) },
        totalAmount: { needs: { totalAmount: true }, compute: (q) => Number(q.totalAmount) },
      },
      quoteItem: {
        unitPrice: { needs: { unitPrice: true }, compute: (item) => Number(item.unitPrice) },
        amount: { needs: { amount: true }, compute: (item) => Number(item.amount) },
      },
      paymentReversal: {
        amountPaid: { needs: { amountPaid: true }, compute: (r) => Number(r.amountPaid) },
      },
      paymentLog: {
        amountPaid: { needs: { amountPaid: true }, compute: (log) => Number(log.amountPaid) },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
