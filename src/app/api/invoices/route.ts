import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { defaultPaymentConfig } from '@/lib/payment-config';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

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
      { invoiceNumber: { contains: q } },
      { project: { title: { contains: q } } },
      { project: { client: { companyName: { contains: q } } } },
      { project: { client: { contactName: { contains: q } } } },
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

  try {
    const body = await request.json();
    const {
      projectId,
      dueDate,
      paymentMethod = 'PAYNOW_QR',
      isGstApplied = defaultPaymentConfig.isGstRegistered,
      gstRate = defaultPaymentConfig.gstRate,
      notes,
      items = [],
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

    // Generate sequential invoice number: JSQ-YYYY-XXXX
    const currentYear = new Date().getFullYear();
    const count = await prisma.invoice.count({
      where: {
        invoiceNumber: {
          startsWith: `JSQ-${currentYear}-`,
        },
      },
    });

    const nextSeq = (count + 1).toString().padStart(4, '0');
    const invoiceNumber = `JSQ-${currentYear}-${nextSeq}`;

    // Calculate item amounts, subtotal, GST, and total
    const {
      items: processedItems,
      subtotal,
      gstRate: calculatedGstRate,
      gstAmount,
      totalAmount,
    } = calculateInvoiceTotals(items, { isGstApplied, gstRate });

    // Create Invoice with items in a transaction
    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          projectId,
          invoiceNumber,
          subtotal,
          isGstApplied,
          gstRate: calculatedGstRate,
          gstAmount,
          totalAmount,
          paidAmount: 0,
          balanceDue: totalAmount,
          issueDate: new Date(),
          dueDate: new Date(dueDate),
          status: 'DRAFT',
          paymentMethod,
          notes: notes || null,
          items: {
            create: processedItems,
          },
        },
        include: {
          project: {
            include: { client: true },
          },
          items: true,
          paymentLogs: true,
        },
      });

      return created;
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error('Create invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
