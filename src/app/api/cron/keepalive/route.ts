import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * A tiny heartbeat. Supabase's free plan pauses a project after a week with no activity, which would
 * take the whole app offline. This makes one trivial read from the database (a row count on the users
 * table, which is tiny) so the project always looks active. It is called by a scheduled job every few
 * days (see vercel.json and .github/workflows/keepalive.yml). It exposes no data, and repeated calls
 * within ten minutes don't touch the database at all.
 */
let lastTouch = 0;
const MIN_GAP_MS = 10 * 60 * 1000;

export async function GET() {
  const now = Date.now();
  if (now - lastTouch < MIN_GAP_MS) {
    return NextResponse.json({ ok: true, skipped: 'checked a moment ago' });
  }
  try {
    await prisma.user.count();
    lastTouch = now;
    console.info('Keep-alive: database touched', new Date(now).toISOString());
    return NextResponse.json({ ok: true, at: new Date(now).toISOString() });
  } catch (error) {
    console.error('Keep-alive failed:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
