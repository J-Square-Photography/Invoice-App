import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Issues a single-use reset link token for a user. Only the hash is stored (same reasoning as
 * password hashing: a database leak shouldn't hand out usable reset links), and the raw token is
 * returned once, to be put straight into the emailed link.
 */
export async function createResetToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  await prisma.user.update({
    where: { id: userId },
    data: {
      resetTokenHash: hashToken(token),
      resetTokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return token;
}

/** Looks up the user a still-valid raw token belongs to, without consuming it. */
export async function findUserByResetToken(token: string): Promise<{ id: string } | null> {
  if (!token) return null;
  const hash = hashToken(token);
  const user = await prisma.user.findFirst({
    where: { resetTokenHash: hash, resetTokenExpiresAt: { gt: new Date() } },
    select: { id: true },
  });
  return user;
}

/** Clears a user's reset token, e.g. once it's been used or a fresh one is about to replace it. */
export async function clearResetToken(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { resetTokenHash: null, resetTokenExpiresAt: null },
  });
}
