import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createResetToken } from '@/lib/password-reset';
import { sendMail } from '@/lib/mailer';

// Always answers the same way whether or not the email is registered, so this endpoint can't be
// used to find out which addresses have accounts.
const GENERIC_MESSAGE = "If that email is registered, we've sent a link to reset the password.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) return NextResponse.json({ error: 'Enter your email address' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, isActive: true } });

    if (user && user.isActive) {
      const token = await createResetToken(user.id);
      const resetUrl = `${request.nextUrl.origin}/reset-password?token=${token}`;
      const html = `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
          <h2>Reset your password</h2>
          <p>Hi ${user.name},</p>
          <p>We received a request to reset the password for your J Square Photography CRM account. This link expires in 1 hour and can only be used once.</p>
          <p style="margin: 24px 0;">
            <a href="${resetUrl}" style="background: #171717; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Reset password</a>
          </p>
          <p style="font-size: 12px; color: #6b7280;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        </div>
      `;
      await sendMail({ to: email, subject: 'Reset your CRM password', html });
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }
}
