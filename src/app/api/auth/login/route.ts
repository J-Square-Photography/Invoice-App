import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, createToken, setSessionCookie } from '@/lib/auth';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Account temporarily locked due to failed login attempts. Try again in ${minutesLeft} minute(s).` },
        { status: 429 }
      );
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
