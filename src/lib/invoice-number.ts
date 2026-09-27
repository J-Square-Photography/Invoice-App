import { randomBytes } from 'crypto';

/**
 * Invoice numbers look like JSQ-2026-8K3F91: a per-year prefix plus a random code, so the
 * number itself never reveals how many invoices exist. True issue order is still fully
 * recoverable at any time (the admin list is already sorted by createdAt), so nothing needs
 * a second identifier to track "1st, 2nd, 3rd" - just the existing chronological record.
 */
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L - avoids visual confusion
const CODE_LENGTH = 6;

export function randomInvoiceCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return code;
}

export const formatInvoiceNumber = (year: number, code: string, series = 'JSQ') => `${series}-${year}-${code}`;

export async function generateInvoiceNumber(year = new Date().getFullYear()): Promise<string> {
  return formatInvoiceNumber(year, randomInvoiceCode());
}

/** True when a create failed only because another request generated the same random code a moment earlier. */
export function isInvoiceNumberClash(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}
