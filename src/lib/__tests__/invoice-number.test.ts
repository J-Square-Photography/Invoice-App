import { describe, it, expect } from 'vitest';
import { nextInvoiceSequence, formatInvoiceNumber } from '../invoice-number';

describe('invoice numbering', () => {
  it('starts at 1 when there are no invoices yet this year', () => {
    expect(nextInvoiceSequence([], 2026)).toBe(1);
    expect(nextInvoiceSequence(['JSQ-2025-0042'], 2026)).toBe(1);
  });

  it('continues after the highest number, not after the count', () => {
    // Invoice 0003 was deleted: a count-based scheme would give 0003 (2 invoices + 1)... then clash with 0004
    expect(nextInvoiceSequence(['JSQ-2026-0001', 'JSQ-2026-0002', 'JSQ-2026-0004'], 2026)).toBe(5);
  });

  it('ignores other years and odd values', () => {
    expect(nextInvoiceSequence(['JSQ-2025-0099', 'JSQ-2026-abc', 'JSQ-2026-0010'], 2026)).toBe(11);
  });

  it('pads to four digits', () => {
    expect(formatInvoiceNumber(2026, 7)).toBe('JSQ-2026-0007');
    expect(formatInvoiceNumber(2026, 12345)).toBe('JSQ-2026-12345');
  });
});
