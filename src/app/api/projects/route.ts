import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { cleanTags, legacyTypeForTags } from '@/lib/service-tags';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const tag = searchParams.get('tag');
  const clientId = searchParams.get('clientId');
  const q = searchParams.get('q');

  const where: Record<string, unknown> = {};
  if (status) where.pipelineStatus = status;
  if (type) where.projectType = type;
  if (tag) where.serviceTags = { has: tag };
  if (clientId) where.clientId = clientId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { client: { companyName: { contains: q, mode: 'insensitive' } } },
      { client: { contactName: { contains: q, mode: 'insensitive' } } },
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
    const serviceTags = cleanTags(body.serviceTags);

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
        serviceTags,
        // Legacy single type follows the first tag when tags are given
        projectType: serviceTags.length > 0 ? legacyTypeForTags(serviceTags) : projectType || 'OTHER',
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
