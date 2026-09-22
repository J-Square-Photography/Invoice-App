import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { deleteImpact } from '@/lib/delete-impact';
import { composeContactName } from '@/lib/client-name';

const clean = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

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

  const { id } = await params;

  try {
    const body = await request.json();
    const { companyName, contactName, salutation, firstName, lastName, email, phone, uen, address, socials, internalNotes } = body;

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
    if (companyName !== undefined) {
      if (typeof companyName !== 'string' || !companyName.trim()) {
        return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
      }
      updateData.companyName = companyName.trim();
    }
    // The salutation/given/family boxes are the source of truth for the printed name whenever the
    // caller touches any of them. A raw contactName sent on its own (e.g. an import script) still
    // works and takes precedence, so nothing here can silently overwrite it with a blank name.
    const touchesNameParts = salutation !== undefined || firstName !== undefined || lastName !== undefined;
    if (salutation !== undefined) updateData.salutation = clean(salutation, 40);
    if (firstName !== undefined) updateData.firstName = clean(firstName, 80);
    if (lastName !== undefined) updateData.lastName = clean(lastName, 80);
    if (contactName !== undefined) {
      updateData.contactName = typeof contactName === 'string' ? contactName.trim() : '';
    } else if (touchesNameParts) {
      const current = await prisma.client.findUnique({ where: { id }, select: { salutation: true, firstName: true, lastName: true } });
      if (!current) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      updateData.contactName = composeContactName({
        salutation: salutation !== undefined ? (updateData.salutation as string | null) : current.salutation,
        firstName: firstName !== undefined ? (updateData.firstName as string | null) : current.firstName,
        lastName: lastName !== undefined ? (updateData.lastName as string | null) : current.lastName,
      });
    }
    if (email !== undefined) updateData.email = typeof email === 'string' && email.trim() ? email.toLowerCase().trim() : null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (uen !== undefined) updateData.uen = uen || null;
    if (address !== undefined) updateData.address = address ? String(address).trim().slice(0, 300) || null : null;
    if (socials !== undefined) updateData.socials = socials || null;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes || null;

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
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

  const { id } = await params;

  try {
    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete client error:', error);
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }
}
