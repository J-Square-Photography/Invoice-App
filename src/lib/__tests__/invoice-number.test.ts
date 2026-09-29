import { describe, it, expect, vi, beforeEach } from 'vitest';

// An in-memory stand-in for the number_series table
const rows = new Map<string, { id: string; code: string; invoiceSeq: number; quoteSeq: number }>();
vi.mock('@/lib/prisma', () => ({
  prisma: {
    numberSeries: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = rows.get(where.id);
        if (!existing) {
          const row = { invoiceSeq: 0, quoteSeq: 0, ...create };
          rows.set(where.id, row);
          return row;
        }
        for (const [k, v] of Object.entries(update as Record<string, { increment: number }>)) {
          (existing as Record<string, unknown>)[k] = (existing as unknown as Record<string, number>)[k] + v.increment;
        }
        return existing;
      }),
    },
  },
}));

import { randomInvoiceCode, formatInvoiceNumber, singaporeYearMonth, nextDocumentNumber } from '../invoice-number';

describe('invoice numbering', () => {
  beforeEach(() => rows.clear());

  it('generates a 6-digit code', () => {
    for (let i = 0; i < 50; i++) {
      const code = randomInvoiceCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[0-9]+$/);
    }
  });

  it('formats as series-year-code followed directly by the counter, unpadded', () => {
    expect(formatInvoiceNumber(2026, '482137', 1)).toBe('JSQ-2026-4821371');
    expect(formatInvoiceNumber(2026, '482137', 10)).toBe('JSQ-2026-48213710');
    expect(formatInvoiceNumber(2026, '482137', 2, 'QUO')).toBe('QUO-2026-4821372');
  });

  it('uses the Singapore month, not UTC', () => {
    expect(singaporeYearMonth(new Date('2026-09-30T15:59:00Z'))).toEqual({ year: 2026, month: 9 });
    expect(singaporeYearMonth(new Date('2026-09-30T16:00:00Z'))).toEqual({ year: 2026, month: 10 });
    expect(singaporeYearMonth(new Date('2026-12-31T16:30:00Z'))).toEqual({ year: 2027, month: 1 });
  });

  it('keeps one code per month and counts up', async () => {
    const sept = new Date('2026-09-10T04:00:00Z');
    const a = await nextDocumentNumber('JSQ', sept);
    const b = await nextDocumentNumber('JSQ', sept);
    const code = a.slice(9, 15);
    expect(a).toBe(`JSQ-2026-${code}1`);
    expect(b).toBe(`JSQ-2026-${code}2`);
  });

  it('shares the month code with quotations, which keep their own counter', async () => {
    const sept = new Date('2026-09-10T04:00:00Z');
    const inv1 = await nextDocumentNumber('JSQ', sept);
    await nextDocumentNumber('JSQ', sept);
    const quo1 = await nextDocumentNumber('QUO', sept);
    const code = inv1.slice(9, 15);
    expect(quo1).toBe(`QUO-2026-${code}1`);
  });

  it('starts a new code and counter in a new month', async () => {
    await nextDocumentNumber('JSQ', new Date('2026-09-10T04:00:00Z'));
    await nextDocumentNumber('JSQ', new Date('2026-09-11T04:00:00Z'));
    const oct = await nextDocumentNumber('JSQ', new Date('2026-10-01T04:00:00Z'));
    expect(oct).toMatch(/^JSQ-2026-[0-9]{6}1$/);
    expect(rows.get('2026-10')?.invoiceSeq).toBe(1);
    expect(rows.size).toBe(2);
  });
});
