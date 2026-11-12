import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { rankClients } from '@/lib/search-rank';
import { CLIENT_TYPE, CONTACT_ROLE_MAX_LENGTH, DEFAULT_CLIENT_TYPE, composeContactName, individualListName, parseClientType } from '@/lib/client-name';
import { logActivity } from '@/lib/activity-log';

const clean = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const limit = searchParams.get('limit');

  // The slim autocomplete path also backs the client picker inside "Create New Project", so it's
  // allowed for either permission; the full list below is the actual Clients section.
  if (limit) {
    if (!hasPermission(user, 'clients') && !hasPermission(user, 'projects')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const wanted = Math.min(Math.max(parseInt(limit, 10) || 8, 1), 25);
    // Pull a wider candidate set, then rank so the best matches (names starting with
    // what was typed) come first before cutting down to the requested number.
    const candidates = await prisma.client.findMany({
      where: q ? {
        OR: [
          { companyName: { contains: q, mode: 'insensitive' } },
          { contactName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      } : undefined,
      select: { id: true, companyName: true, contactName: true, email: true },
      take: 100,
      orderBy: { companyName: 'asc' },
    });
    const clients = rankClients(candidates, q).slice(0, wanted);
    return NextResponse.json({ clients });
  }

  if (!hasPermission(user, 'clients')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const clients = await prisma.client.findMany({
    where: q ? {
      OR: [
        { companyName: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ],
    } : undefined,
    include: {
      _count: { select: { projects: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ clients });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  // Allowed from the Clients page (clients) or from the inline "Create new client" button while
  // creating a project (projects) — see src/app/admin/projects/page.tsx.
  if (!hasPermission(user, 'clients') && !hasPermission(user, 'projects')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { clientType: rawType, companyName, contactName, contactRole, salutation, firstName, lastName, email, phone, uen, address, socials, internalNotes } = body;

    // Callers that predate client types (e.g. import scripts) create organisations, as before
    const clientType = rawType === undefined ? DEFAULT_CLIENT_TYPE : parseClientType(rawType);
    if (!clientType) {
      return NextResponse.json({ error: 'Choose whether the client is an individual or an organisation' }, { status: 400 });
    }

    const nameParts = { salutation: clean(salutation, 40), firstName: clean(firstName, 80), lastName: clean(lastName, 80) };
    // The salutation/given/family boxes are the source of truth when present; a raw contactName
    // (e.g. from an import script) is only used as a fallback so nothing forces the split.
    const composedName = composeContactName(nameParts);

    // An individual is listed under their own name; an organisation needs its name typed in
    let listName: string;
    if (clientType === CLIENT_TYPE.INDIVIDUAL) {
      if (!nameParts.firstName) {
        return NextResponse.json({ error: "Enter the client's given name" }, { status: 400 });
      }
      listName = individualListName(nameParts);
    } else {
      if (typeof companyName !== 'string' || !companyName.trim()) {
        return NextResponse.json({ error: 'Organisation name is required' }, { status: 400 });
      }
      listName = companyName.trim();
    }

    // Everything except the name is optional
    const normalizedEmail = typeof email === 'string' && email.trim() ? email.toLowerCase().trim() : null;

    if (normalizedEmail) {
      const existing = await prisma.client.findUnique({
        where: { email: normalizedEmail },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'A client with this email already exists' },
          { status: 409 }
        );
      }
    }

    const client = await prisma.client.create({
      data: {
        clientType,
        companyName: listName,
        contactName: composedName || (typeof contactName === 'string' ? contactName.trim() : ''),
        contactRole: clientType === CLIENT_TYPE.ORGANISATION ? clean(contactRole, CONTACT_ROLE_MAX_LENGTH) : null,
        ...nameParts,
        email: normalizedEmail,
        phone: phone || null,
        uen: clientType === CLIENT_TYPE.ORGANISATION ? uen || null : null,
        address: address ? String(address).trim().slice(0, 300) || null : null,
        socials: socials || null,
        internalNotes: internalNotes || null,
      },
    });

    await logActivity({
      user,
      action: 'CREATE',
      entityType: 'CLIENT',
      entityId: client.id,
      entityLabel: client.companyName,
      description: `Added client ${client.companyName}.`,
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
