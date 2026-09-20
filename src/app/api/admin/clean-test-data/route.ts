import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (currentUser.role !== ROLES.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Forbidden. Super Admin only.' }, { status: 403 });
  }

  try {
    // 1. Find test managers (excluding the logged in user)
    const testUsers = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUser.userId } },
          {
            OR: [
              { email: { startsWith: 'manager-' } },
              { name: 'Photographer Sarah' },
            ],
          },
        ],
      },
      select: { id: true, email: true },
    });

    const deletedUserCount = await prisma.user.deleteMany({
      where: {
        id: { in: testUsers.map((u) => u.id) },
      },
    });

    // 2. Find test clients
    const testClients = await prisma.client.findMany({
      where: {
        OR: [
          { email: { startsWith: 'client-' } },
          { uen: '202109876K' },
          { companyName: { contains: 'Nexus Tech Singapore' } },
        ],
      },
      select: { id: true },
    });

    const testClientIds = testClients.map((c) => c.id);

    // 3. Find test projects for those clients
    const testProjects = await prisma.project.findMany({
      where: {
        clientId: { in: testClientIds },
      },
      select: { id: true },
    });

    const testProjectIds = testProjects.map((p) => p.id);

    // 4. Find invoices for those projects
    const testInvoices = await prisma.invoice.findMany({
      where: {
        projectId: { in: testProjectIds },
      },
      select: { id: true },
    });

    const testInvoiceIds = testInvoices.map((i) => i.id);

    // 5. Delete associated contracts and signature audits
    const testContracts = await prisma.contract.findMany({
      where: {
        invoiceId: { in: testInvoiceIds },
      },
      select: { id: true },
    });

    const testContractIds = testContracts.map((c) => c.id);

    if (testContractIds.length > 0) {
      await prisma.signatureAudit.deleteMany({
        where: { contractId: { in: testContractIds } },
      });
      await prisma.contract.deleteMany({
        where: { id: { in: testContractIds } },
      });
    }

    // 6. Delete invoice line items & payment logs
    if (testInvoiceIds.length > 0) {
      await prisma.invoiceItem.deleteMany({
        where: { invoiceId: { in: testInvoiceIds } },
      });
      await prisma.paymentLog.deleteMany({
        where: { invoiceId: { in: testInvoiceIds } },
      });
      await prisma.invoice.deleteMany({
        where: { id: { in: testInvoiceIds } },
      });
    }

    // 7. Delete projects
    if (testProjectIds.length > 0) {
      await prisma.project.deleteMany({
        where: { id: { in: testProjectIds } },
      });
    }

    // 8. Delete clients
    if (testClientIds.length > 0) {
      await prisma.client.deleteMany({
        where: { id: { in: testClientIds } },
      });
    }

    return NextResponse.json({
      success: true,
      deleted: {
        users: deletedUserCount.count,
        clients: testClientIds.length,
        projects: testProjectIds.length,
        invoices: testInvoiceIds.length,
        contracts: testContractIds.length,
      },
    });
  } catch (error) {
    console.error('Clean test data error:', error);
    return NextResponse.json(
      { error: 'Failed to clean test data' },
      { status: 500 }
    );
  }
}
