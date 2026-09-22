import { describe, it, expect } from 'vitest';
import { isQuoteExpired, displayQuoteStatus, isQuoteStatus } from '../quote-status';
import { nextInvoiceSequence, formatInvoiceNumber } from '../invoice-number';

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
  it('counts in its own QUO series, separately from invoices', () => {
    expect(nextInvoiceSequence(['JSQ-2026-0017'], 2026, 'QUO')).toBe(1);
    expect(nextInvoiceSequence(['QUO-2026-0001', 'QUO-2026-0002', 'JSQ-2026-0017'], 2026, 'QUO')).toBe(3);
    expect(formatInvoiceNumber(2026, 3, 'QUO')).toBe('QUO-2026-0003');
  });
});
