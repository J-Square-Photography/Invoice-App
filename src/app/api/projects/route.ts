import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { cleanTags, legacyTypeForTags } from '@/lib/service-tags';
import { isPipelineStatus, parseOptionalDate, cleanTitle } from '@/lib/project-validation';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  // Also backs the project picker inside the Invoice/Quote form (see invoice-form-dialog.tsx),
  // so anyone who can create one of those needs read access here too.
  if (!hasPermission(user, 'projects') && !hasPermission(user, 'invoices') && !hasPermission(user, 'quotes')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
  if (!hasPermission(user, 'projects')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { clientId, title, projectType, pipelineStatus, shootDate, notes } = body;
    const serviceTags = cleanTags(body.serviceTags);

    const cleanedTitle = cleanTitle(title);
    if (!clientId || !cleanedTitle) {
      return NextResponse.json(
        { error: 'Client and title are required' },
        { status: 400 }
      );
    }
    if (pipelineStatus !== undefined && pipelineStatus !== '' && !isPipelineStatus(pipelineStatus)) {
      return NextResponse.json({ error: 'Invalid project status' }, { status: 400 });
    }
    const parsedDate = parseOptionalDate(shootDate);
    if ('error' in parsedDate) return NextResponse.json({ error: parsedDate.error }, { status: 400 });

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const project = await prisma.project.create({
      data: {
        clientId,
        title: cleanedTitle,
        serviceTags,
        // Legacy single type follows the first tag when tags are given
        projectType: serviceTags.length > 0 ? legacyTypeForTags(serviceTags) : projectType || 'OTHER',
        pipelineStatus: pipelineStatus || 'INQUIRY',
        shootDate: parsedDate.date,
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
