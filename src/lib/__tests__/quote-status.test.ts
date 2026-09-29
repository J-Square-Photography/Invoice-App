import { describe, it, expect } from 'vitest';
import { isQuoteExpired, displayQuoteStatus, isQuoteStatus } from '../quote-status';
import { formatInvoiceNumber } from '../invoice-number';

describe('quotation status', () => {
  const now = new Date(2026, 8, 22, 15, 0);

  it('a sent quote past its valid-until date reads as expired', () => {
    expect(isQuoteExpired('SENT', new Date(2026, 8, 21), now)).toBe(true);
    expect(displayQuoteStatus('SENT', new Date(2026, 8, 21), now)).toBe('EXPIRED');
  });

  it('valid today is still valid, and other statuses never expire', () => {
    expect(isQuoteExpired('SENT', new Date(2026, 8, 22), now)).toBe(false);
    expect(displayQuoteStatus('ACCEPTED', new Date(2026, 0, 1), now)).toBe('ACCEPTED');
    expect(displayQuoteStatus('DRAFT', new Date(2026, 0, 1), now)).toBe('DRAFT');
    expect(displayQuoteStatus('DECLINED', new Date(2026, 0, 1), now)).toBe('DECLINED');
  });

  it('recognises only the four real statuses', () => {
    expect(isQuoteStatus('SENT')).toBe(true);
    expect(isQuoteStatus('EXPIRED')).toBe(false);
    expect(isQuoteStatus('PAID')).toBe(false);
  });
});

describe('quotation numbering', () => {
  it('formats in its own QUO series, separately from invoices', () => {
    expect(formatInvoiceNumber(2026, '8K3F91', 1, 'QUO')).toBe('QUO-2026-8K3F911');
  });
});
