import nodemailer from 'nodemailer';

/**
 * Sends mail through Gmail's own SMTP relay using a Google Account App Password — no paid email
 * service, no domain to verify, just the studio's existing free Gmail account. Set GMAIL_USER (the
 * address) and GMAIL_APP_PASSWORD (a 16-character App Password, not the account password itself;
 * generated at myaccount.google.com/apppasswords, which requires 2-Step Verification to be on) in
 * the environment. Gmail's free sending limit (~500/day) is far beyond what this app ever needs.
 */
let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return cachedTransporter;
}

export function isMailerConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export async function sendMail(options: { to: string; subject: string; html: string }): Promise<{ success: boolean; error?: string }> {
  const transporter = getTransporter();
  if (!transporter) return { success: false, error: 'Mailer not configured (GMAIL_USER / GMAIL_APP_PASSWORD)' };

  try {
    await transporter.sendMail({
      from: `"J Square Photography CRM" <${process.env.GMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return { success: true };
  } catch (err) {
    console.error('Failed to send mail:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send mail' };
  }
}
