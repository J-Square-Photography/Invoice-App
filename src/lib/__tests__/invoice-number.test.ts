import { describe, it, expect } from 'vitest';
import { randomInvoiceCode, formatInvoiceNumber } from '../invoice-number';

describe('invoice numbering', () => {
  it('generates a 6-character code from the non-confusable alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = randomInvoiceCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]+$/);
    }
  });

  it('formats as series-year-code, revealing nothing about how many exist', () => {
    expect(formatInvoiceNumber(2026, '8K3F91')).toBe('JSQ-2026-8K3F91');
    expect(formatInvoiceNumber(2026, '8K3F91', 'QUO')).toBe('QUO-2026-8K3F91');
  });
});
