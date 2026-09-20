import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const limit = searchParams.get('limit');

  // If limit is set, return slim results for autocomplete
  if (limit) {
    const clients = await prisma.client.findMany({
      where: q ? {
        OR: [
          { companyName: { contains: q } },
          { contactName: { contains: q } },
          { email: { contains: q } },
        ],
      } : undefined,
      select: { id: true, companyName: true, contactName: true, email: true },
      take: parseInt(limit, 10),
      orderBy: { companyName: 'asc' },
    });
    return NextResponse.json({ clients });
  }

  const clients = await prisma.client.findMany({
    where: q ? {
      OR: [
        { companyName: { contains: q } },
        { contactName: { contains: q } },
        { email: { contains: q } },
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

  try {
    const body = await request.json();
    const { companyName, contactName, email, phone, uen, socials, internalNotes } = body;

    if (!companyName || !contactName || !email) {
      return NextResponse.json(
        { error: 'Company name, contact name, and email are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.client.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A client with this email already exists' },
        { status: 409 }
      );
    }

    const client = await prisma.client.create({
      data: {
        companyName,
        contactName,
        email: normalizedEmail,
        phone: phone || null,
        uen: uen || null,
        socials: socials || null,
        internalNotes: internalNotes || null,
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
