import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { defaultPaymentConfig } from '@/lib/payment-config';
import { createDraftInvoice } from '@/lib/create-invoice';
import { logActivity } from '@/lib/activity-log';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  // Also backs the invoice picker inside "Create Contract" (see admin/contracts/page.tsx).
  if (!hasPermission(user, 'invoices') && !hasPermission(user, 'contracts')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const projectId = searchParams.get('projectId');
  const clientId = searchParams.get('clientId');
  const q = searchParams.get('q');

  const where: Record<string, unknown> = {};
  if (status && status !== 'ALL') where.status = status;
  if (projectId) where.projectId = projectId;
  if (clientId) where.project = { clientId };
  if (q) {
    where.OR = [
      { invoiceNumber: { contains: q, mode: 'insensitive' } },
      { project: { title: { contains: q, mode: 'insensitive' } } },
      { project: { client: { companyName: { contains: q, mode: 'insensitive' } } } },
      { project: { client: { contactName: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      project: {
        include: {
          client: {
            select: { id: true, companyName: true, contactName: true, email: true },
          },
        },
      },
      items: true,
      paymentLogs: {
        orderBy: { paymentDate: 'desc' },
      },
      contract: {
        select: { id: true, isSigned: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ invoices });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'invoices')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const {
      projectId,
      dueDate,
      paymentMethod = 'PAYNOW_QR',
      isGstApplied = defaultPaymentConfig.isGstRegistered,
      gstRate = defaultPaymentConfig.gstRate,
      deposit,
      depositAmount,
      notes,
      internalNotes,
      items = [],
      discounts = [],
    } = body;

    if (!projectId || !dueDate) {
      return NextResponse.json(
        { error: 'Project and due date are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required' },
        { status: 400 }
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { client: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const invoice = await createDraftInvoice({
      projectId,
      dueDate,
      paymentMethod,
      isGstApplied,
      gstRate,
      deposit: deposit ?? depositAmount,
      notes,
      internalNotes,
      items,
      discounts: Array.isArray(discounts) ? discounts : [],
    });

    await logActivity({
      user,
      action: 'CREATE',
      entityType: 'INVOICE',
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      description: `Created invoice ${invoice.invoiceNumber} for ${project.client.companyName}.`,
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
