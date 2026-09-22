import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

/** The proof image for a payment. Only signed-in team members can open it. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const proof = await prisma.paymentProof.findUnique({ where: { paymentId: id } });
  if (!proof) return NextResponse.json({ error: 'No proof was attached to this payment' }, { status: 404 });

  return new Response(new Uint8Array(proof.data), {
    status: 200,
    headers: {
      'Content-Type': proof.mime,
      // Private: contains bank details, so shared caches must not keep it
      'Cache-Control': 'private, max-age=86400',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
