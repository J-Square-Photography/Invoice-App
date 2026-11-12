import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { deleteImpact } from '@/lib/delete-impact';
import { CLIENT_TYPE, CONTACT_ROLE_MAX_LENGTH, clientTypeOf, composeContactName, individualListName, parseClientType, type ClientType } from '@/lib/client-name';
import { hasPermission } from '@/lib/permissions';
import { logActivity } from '@/lib/activity-log';

const clean = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'clients')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { invoices: true } },
        },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // What this client has been billed and has paid (issued invoices only: no drafts, no voids)
  const billed = await prisma.invoice.aggregate({
    where: { project: { clientId: id }, status: { in: ['SENT', 'PARTIAL', 'PAID'] } },
    _sum: { totalAmount: true, paidAmount: true, balanceDue: true },
  });
  const financials = {
    invoiced: Number(billed._sum.totalAmount ?? 0),
    paid: Number(billed._sum.paidAmount ?? 0),
    outstanding: Number(billed._sum.balanceDue ?? 0),
  };

  return NextResponse.json({ client, impact: await deleteImpact({ clientId: id }), financials });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'clients')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json();
    const { clientType: rawType, companyName, contactName, contactRole, salutation, firstName, lastName, email, phone, uen, address, socials, internalNotes } = body;

    const current = await prisma.client.findUnique({
      where: { id },
      select: { clientType: true, salutation: true, firstName: true, lastName: true },
    });
    if (!current) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    let clientType: ClientType = clientTypeOf(current);
    if (rawType !== undefined) {
      const parsed = parseClientType(rawType);
      if (!parsed) {
        return NextResponse.json({ error: 'Choose whether the client is an individual or an organisation' }, { status: 400 });
      }
      clientType = parsed;
    }

    // If email is changing, check uniqueness
    if (typeof email === 'string' && email.trim()) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.client.findFirst({
        where: { email: normalizedEmail, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'A client with this email already exists' },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (rawType !== undefined) updateData.clientType = clientType;
    // The salutation/given/family boxes are the source of truth for the printed name whenever the
    // caller touches any of them. A raw contactName sent on its own (e.g. an import script) still
    // works and takes precedence, so nothing here can silently overwrite it with a blank name.
    const touchesNameParts = salutation !== undefined || firstName !== undefined || lastName !== undefined;
    if (salutation !== undefined) updateData.salutation = clean(salutation, 40);
    if (firstName !== undefined) updateData.firstName = clean(firstName, 80);
    if (lastName !== undefined) updateData.lastName = clean(lastName, 80);
    const nameParts = {
      salutation: salutation !== undefined ? (updateData.salutation as string | null) : current.salutation,
      firstName: firstName !== undefined ? (updateData.firstName as string | null) : current.firstName,
      lastName: lastName !== undefined ? (updateData.lastName as string | null) : current.lastName,
    };
    if (contactName !== undefined) {
      updateData.contactName = typeof contactName === 'string' ? contactName.trim() : '';
    } else if (touchesNameParts) {
      updateData.contactName = composeContactName(nameParts);
    }

    if (clientType === CLIENT_TYPE.INDIVIDUAL) {
      // An individual is listed under their own name, kept in step with the name boxes. They have
      // no separate representative role or company registration number.
      if (rawType !== undefined || touchesNameParts) {
        if (!nameParts.firstName) {
          return NextResponse.json({ error: "Enter the client's given name" }, { status: 400 });
        }
        updateData.companyName = individualListName(nameParts);
        updateData.contactRole = null;
        updateData.uen = null;
      }
    } else {
      if (companyName !== undefined) {
        if (typeof companyName !== 'string' || !companyName.trim()) {
          return NextResponse.json({ error: 'Organisation name is required' }, { status: 400 });
        }
        updateData.companyName = companyName.trim();
      }
      if (contactRole !== undefined) updateData.contactRole = clean(contactRole, CONTACT_ROLE_MAX_LENGTH);
    }
    if (email !== undefined) updateData.email = typeof email === 'string' && email.trim() ? email.toLowerCase().trim() : null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (uen !== undefined && clientType === CLIENT_TYPE.ORGANISATION) updateData.uen = uen || null;
    if (address !== undefined) updateData.address = address ? String(address).trim().slice(0, 300) || null : null;
    if (socials !== undefined) updateData.socials = socials || null;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes || null;

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      user,
      action: 'UPDATE',
      entityType: 'CLIENT',
      entityId: client.id,
      entityLabel: client.companyName,
      description: `Updated client ${client.companyName}.`,
    });

    return NextResponse.json({ client });
  } catch (error) {
    console.error('Update client error:', error);
    return NextResponse.json({ error: 'Client not found or update failed' }, { status: 404 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'clients')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  try {
    const deleted = await prisma.client.delete({ where: { id } });
    await logActivity({
      user,
      action: 'DELETE',
      entityType: 'CLIENT',
      entityId: id,
      entityLabel: deleted.companyName,
      description: `Deleted client ${deleted.companyName}.`,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete client error:', error);
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
}
