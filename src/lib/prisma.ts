import { PrismaClient } from '@prisma/client';

// Money columns are stored as Postgres `numeric` (via Prisma `Decimal`) for
// accurate storage, but the rest of the app works with plain JS numbers
// (arithmetic, .toFixed(), JSON responses, PDF generation). This extension
// converts Decimal <-> number at the client boundary so no other file has to
// deal with Decimal objects directly.
function createPrismaClient() {
  return new PrismaClient().$extends({
    result: {
      invoice: {
        subtotal: { needs: { subtotal: true }, compute: (invoice) => Number(invoice.subtotal) },
        gstAmount: { needs: { gstAmount: true }, compute: (invoice) => Number(invoice.gstAmount) },
        totalAmount: { needs: { totalAmount: true }, compute: (invoice) => Number(invoice.totalAmount) },
        paidAmount: { needs: { paidAmount: true }, compute: (invoice) => Number(invoice.paidAmount) },
        balanceDue: { needs: { balanceDue: true }, compute: (invoice) => Number(invoice.balanceDue) },
      },
      invoiceItem: {
        unitPrice: { needs: { unitPrice: true }, compute: (item) => Number(item.unitPrice) },
        amount: { needs: { amount: true }, compute: (item) => Number(item.amount) },
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
