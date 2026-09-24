import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { cleanTags, legacyTypeForTags } from '@/lib/service-tags';
import { isPipelineStatus, parseOptionalDate, cleanTitle } from '@/lib/project-validation';
import { deleteImpact } from '@/lib/delete-impact';
import { sanitizeRequestedCrew } from '@/lib/skill-levels';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'projects')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      invoices: {
        orderBy: { createdAt: 'desc' },
      },
      quotes: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({ project, impact: await deleteImpact({ projectId: id }) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'projects')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { title, projectType, pipelineStatus, shootDate, notes, clientId } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) {
      const clean = cleanTitle(title);
      if (!clean) return NextResponse.json({ error: 'Project title cannot be empty' }, { status: 400 });
      updateData.title = clean;
    }
    if (projectType !== undefined) updateData.projectType = projectType;
    if (body.serviceTags !== undefined) {
      const serviceTags = cleanTags(body.serviceTags);
      updateData.serviceTags = serviceTags;
      if (serviceTags.length > 0) updateData.projectType = legacyTypeForTags(serviceTags);
    }
    if (pipelineStatus !== undefined) {
      if (!isPipelineStatus(pipelineStatus)) return NextResponse.json({ error: 'Invalid project status' }, { status: 400 });
      updateData.pipelineStatus = pipelineStatus;
    }
    if (shootDate !== undefined) {
      const parsed = parseOptionalDate(shootDate);
      if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      updateData.shootDate = parsed.date;
    }
    if (notes !== undefined) updateData.notes = notes || null;
    if (body.requestedCrew !== undefined) {
      const crew = sanitizeRequestedCrew(body.requestedCrew);
      updateData.requestedCrew = crew.length > 0 ? (crew as unknown as object) : null;
    }
    if (clientId !== undefined) {
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      updateData.clientId = clientId;
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        client: {
          select: { id: true, companyName: true, contactName: true },
        },
      },
    });

    return NextResponse.json({ project, impact: await deleteImpact({ projectId: id }) });
  } catch (error) {
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Project not found or update failed' }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'projects')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
}
