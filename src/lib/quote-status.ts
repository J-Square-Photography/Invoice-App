/** A quotation's life: DRAFT -> SENT -> ACCEPTED (converted to an invoice) or DECLINED. */
export const QUOTE_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
};

export const isQuoteStatus = (value: unknown): value is QuoteStatus =>
  typeof value === 'string' && (QUOTE_STATUSES as readonly string[]).includes(value);

/** A quote that was sent and whose valid-until date has passed without an answer. */
export function isQuoteExpired(status: string, validUntil: string | Date, now: Date = new Date()): boolean {
  if (status !== 'SENT') return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return new Date(validUntil) < startOfToday;
}

/** The status to show: a sent quote past its date reads as Expired. */
export function displayQuoteStatus(status: string, validUntil: string | Date, now: Date = new Date()): string {
  return isQuoteExpired(status, validUntil, now) ? 'EXPIRED' : status;
}

/** Days a quotation stays valid unless the date is changed. */
export const DEFAULT_QUOTE_VALID_DAYS = 30;
