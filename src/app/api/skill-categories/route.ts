import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

function cleanOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const trimmed = v.trim().slice(0, 40);
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out.slice(0, 10);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const categories = await prisma.skillCategory.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ categories });
}

/** Lets an admin define a new tag category for staff profiles (e.g. "DSLR Photobooth" with options
 * ["Main", "Assistant"]) beyond the built-in Photography/Videography rate-card disciplines. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!hasPermission(user, 'staff')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '';
    const options = cleanOptions(body.options);

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (options.length === 0) return NextResponse.json({ error: 'At least one option is required' }, { status: 400 });

    const existing = await prisma.skillCategory.findUnique({ where: { name } });
    if (existing) return NextResponse.json({ error: 'A skill category with this name already exists' }, { status: 409 });

    const category = await prisma.skillCategory.create({ data: { name, options } });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Create skill category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
