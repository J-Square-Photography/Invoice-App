import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { createQuote } from '@/lib/create-quote';
import { isQuoteStatus } from '@/lib/quote-status';
import { defaultPaymentConfig } from '@/lib/payment-config';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'quotes')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const projectId = searchParams.get('projectId');
  const q = searchParams.get('q');

  const where: Record<string, unknown> = {};
  if (status && isQuoteStatus(status)) where.status = status;
  if (projectId) where.projectId = projectId;
  if (q) {
    where.OR = [
      { quoteNumber: { contains: q, mode: 'insensitive' } },
      { project: { title: { contains: q, mode: 'insensitive' } } },
      { project: { client: { companyName: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      project: { include: { client: { select: { id: true, companyName: true, contactName: true, email: true, phone: true } } } },
      items: true,
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ quotes });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'quotes')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const {
      projectId,
      validUntil,
      isGstApplied = defaultPaymentConfig.isGstRegistered,
      gstRate = defaultPaymentConfig.gstRate,
      notes,
      items = [],
      discounts = [],
    } = body;

    if (!projectId || !validUntil) {
      return NextResponse.json({ error: 'Project and valid-until date are required' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const quote = await createQuote({
      projectId,
      validUntil,
      isGstApplied,
      gstRate,
      notes,
      items,
      discounts: Array.isArray(discounts) ? discounts : [],
    });

    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    console.error('Create quote error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
