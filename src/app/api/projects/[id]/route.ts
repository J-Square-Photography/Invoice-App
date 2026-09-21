import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { cleanTags, legacyTypeForTags } from '@/lib/service-tags';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      invoices: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  return NextResponse.json({ project });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { title, projectType, pipelineStatus, shootDate, notes, clientId } = body;

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (projectType !== undefined) updateData.projectType = projectType;
    if (body.serviceTags !== undefined) {
      const serviceTags = cleanTags(body.serviceTags);
      updateData.serviceTags = serviceTags;
      if (serviceTags.length > 0) updateData.projectType = legacyTypeForTags(serviceTags);
    }
    if (pipelineStatus !== undefined) updateData.pipelineStatus = pipelineStatus;
    if (shootDate !== undefined) updateData.shootDate = shootDate ? new Date(shootDate) : null;
    if (notes !== undefined) updateData.notes = notes || null;
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

    return NextResponse.json({ project });
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

  const { id } = await params;

  try {
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
}
