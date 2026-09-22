import { prisma } from '@/lib/prisma';

/** Everything that is deleted along with a client or project (all cascade in the database). */
export interface DeleteImpact {
  projects: number;
  invoices: number;
  quotes: number;
  payments: number;
  paymentsTotal: number;
  contracts: number;
  signedContracts: number;
}

export async function deleteImpact(scope: { clientId: string } | { projectId: string }): Promise<DeleteImpact> {
  const invoiceWhere = 'projectId' in scope ? { projectId: scope.projectId } : { project: { clientId: scope.clientId } };
  const quoteWhere = 'projectId' in scope ? { projectId: scope.projectId } : { project: { clientId: scope.clientId } };
  const [projects, invoices, quotes, payments, paid, contracts, signedContracts] = await Promise.all([
    'clientId' in scope ? prisma.project.count({ where: { clientId: scope.clientId } }) : Promise.resolve(0),
    prisma.invoice.count({ where: invoiceWhere }),
    prisma.quote.count({ where: quoteWhere }),
    prisma.paymentLog.count({ where: { invoice: invoiceWhere } }),
    prisma.paymentLog.aggregate({ _sum: { amountPaid: true }, where: { invoice: invoiceWhere } }),
    prisma.contract.count({ where: { invoice: invoiceWhere } }),
    prisma.contract.count({ where: { invoice: invoiceWhere, isSigned: true } }),
  ]);
  return { projects, invoices, quotes, payments, paymentsTotal: Number(paid._sum.amountPaid ?? 0), contracts, signedContracts };
}
