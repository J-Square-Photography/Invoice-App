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
    invoice: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    quote: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { randomInvoiceCode, formatInvoiceNumber, singaporeYearMonth, nextDocumentNumber, convertQuoteNumberToInvoiceNumber } from '../invoice-number';

describe('invoice numbering', () => {
  beforeEach(() => rows.clear());

  it('generates a 5-digit code', () => {
    for (let i = 0; i < 50; i++) {
      const code = randomInvoiceCode();
      expect(code).toHaveLength(5);
      expect(code).toMatch(/^[1-9][0-9]{4}$/);
    }
  });

  it('formats as series-year-code followed directly by the counter, unpadded', () => {
    expect(formatInvoiceNumber(2026, '87325', 1)).toBe('INV-2026-873251');
    expect(formatInvoiceNumber(2026, '87325', 10)).toBe('INV-2026-8732510');
    expect(formatInvoiceNumber(2026, '87325', 2, 'QUO')).toBe('QUO-2026-873252');
  });

  it('converts quotation numbers to matching invoice numbers', () => {
    expect(convertQuoteNumberToInvoiceNumber('QUO-2026-873251')).toBe('INV-2026-873251');
    expect(convertQuoteNumberToInvoiceNumber('QUO-2026-235972')).toBe('INV-2026-235972');
    expect(convertQuoteNumberToInvoiceNumber('#QUO-2026-873251')).toBe('#INV-2026-873251');
  });

  it('uses the Singapore month, not UTC', () => {
    expect(singaporeYearMonth(new Date('2026-09-30T15:59:00Z'))).toEqual({ year: 2026, month: 9 });
    expect(singaporeYearMonth(new Date('2026-09-30T16:00:00Z'))).toEqual({ year: 2026, month: 10 });
    expect(singaporeYearMonth(new Date('2026-12-31T16:30:00Z'))).toEqual({ year: 2027, month: 1 });
  });

  it('keeps one code per month and counts up', async () => {
    const sept = new Date('2026-09-10T04:00:00Z');
    const a = await nextDocumentNumber('INV', sept);
    const b = await nextDocumentNumber('INV', sept);
    const code = a.slice(9, 14);
    expect(a).toBe(`INV-2026-${code}1`);
    expect(b).toBe(`INV-2026-${code}2`);
  });

  it('shares the month code with quotations, which keep their own counter', async () => {
    const sept = new Date('2026-09-10T04:00:00Z');
    const inv1 = await nextDocumentNumber('INV', sept);
    await nextDocumentNumber('INV', sept);
    const quo1 = await nextDocumentNumber('QUO', sept);
    const code = inv1.slice(9, 14);
    expect(quo1).toBe(`QUO-2026-${code}1`);
  });

  it('starts a new code and counter in a new month', async () => {
    await nextDocumentNumber('INV', new Date('2026-09-10T04:00:00Z'));
    await nextDocumentNumber('INV', new Date('2026-09-11T04:00:00Z'));
    const oct = await nextDocumentNumber('INV', new Date('2026-10-01T04:00:00Z'));
    expect(oct).toMatch(/^INV-2026-[0-9]{5}1$/);
    expect(rows.get('2026-10')?.invoiceSeq).toBe(1);
    expect(rows.size).toBe(2);
  });
});

