import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/** Quick cross-record search for the Ctrl+K box: a few clients, projects and invoices. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 80);
  if (!q) return NextResponse.json({ clients: [], projects: [], invoices: [], quotes: [] });

  const has = (field: string) => ({ [field]: { contains: q, mode: 'insensitive' as const } });

  const [clients, projects, invoices, quotes] = await Promise.all([
    prisma.client.findMany({
      where: { OR: [has('companyName'), has('contactName'), has('email'), has('phone')] },
      select: { id: true, companyName: true, contactName: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.project.findMany({
      where: { OR: [has('title'), { client: has('companyName') }] },
      select: { id: true, title: true, pipelineStatus: true, client: { select: { companyName: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { OR: [has('invoiceNumber'), { project: has('title') }, { project: { client: has('companyName') } }] },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        totalAmount: true,
        project: { select: { title: true, client: { select: { companyName: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.quote.findMany({
      where: { OR: [has('quoteNumber'), { project: has('title') }, { project: { client: has('companyName') } }] },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        totalAmount: true,
        project: { select: { title: true, client: { select: { companyName: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);

  return NextResponse.json({
    clients,
    projects,
    invoices: invoices.map((i) => ({ ...i, totalAmount: Number(i.totalAmount) })),
    quotes: quotes.map((q) => ({ ...q, totalAmount: Number(q.totalAmount) })),
  });
}
