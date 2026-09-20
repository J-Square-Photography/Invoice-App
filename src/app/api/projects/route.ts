import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const clientId = searchParams.get('clientId');
  const q = searchParams.get('q');

  const where: Record<string, unknown> = {};
  if (status) where.pipelineStatus = status;
  if (type) where.projectType = type;
  if (clientId) where.clientId = clientId;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { client: { companyName: { contains: q } } },
      { client: { contactName: { contains: q } } },
    ];
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      client: {
        select: { id: true, companyName: true, contactName: true, email: true },
      },
      _count: { select: { invoices: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const body = await request.json();
    const { clientId, title, projectType, pipelineStatus, shootDate, notes } = body;

    if (!clientId || !title) {
      return NextResponse.json(
        { error: 'Client and title are required' },
        { status: 400 }
      );
    }

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const project = await prisma.project.create({
      data: {
        clientId,
        title,
        projectType: projectType || 'PORTRAIT',
        pipelineStatus: pipelineStatus || 'INQUIRY',
        shootDate: shootDate ? new Date(shootDate) : null,
        notes: notes || null,
      },
      include: {
        client: {
          select: { id: true, companyName: true, contactName: true },
        },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
