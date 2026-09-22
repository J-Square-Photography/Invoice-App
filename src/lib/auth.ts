import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. Generate one with `openssl rand -hex 32` and set it in .env.local (see .env.example).'
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const COOKIE_NAME = 'jsquare-session';
const TOKEN_EXPIRY = '7d';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
  permissions?: string[];
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// A valid token is not enough: the person must still exist, still be active, and their role is
// whatever it is now (not what it was when they logged in). Otherwise deactivating or demoting
// someone would take up to 7 days to take effect. The lookup is cached for a few seconds.
const USER_CACHE_MS = 15_000;
type LiveUser = { isActive: boolean; role: string; name: string; email: string; permissions: string[] };
const userCache = new Map<string, { at: number; user: LiveUser | null }>();

/** Forget a cached user, e.g. right after their account was changed, so the change applies at once. */
export function invalidateUserCache(userId?: string): void {
  if (userId) userCache.delete(userId);
  else userCache.clear();
}

async function lookupUser(userId: string): Promise<LiveUser | null> {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.at < USER_CACHE_MS) return cached.user;
  try {
    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, role: true, name: true, email: true, permissions: true },
    });
    userCache.set(userId, { at: Date.now(), user });
    return user;
  } catch (error) {
    console.error('Could not check the signed-in user:', error);
    // If the database blips, keep trusting the last answer rather than logging everyone out
    return cached?.user ?? null;
  }
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.userId) return null;
  const live = await lookupUser(payload.userId);
  if (!live || !live.isActive) return null;
  return { userId: payload.userId, email: live.email, name: live.name, role: live.role, permissions: live.permissions };
}
