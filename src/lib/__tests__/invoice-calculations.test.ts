import { describe, it, expect } from 'vitest';
import { roundCents, processInvoiceItem, calculateInvoiceTotals } from '../invoice-calculations';

describe('roundCents', () => {
  it('avoids classic floating point drift', () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
  });

  it('rounds half-cent values consistently', () => {
    expect(roundCents(19.995)).toBe(20);
  });
});

describe('processInvoiceItem', () => {
  it('defaults missing description to "Service Item"', () => {
    const item = processInvoiceItem({ quantity: 1, unitPrice: 100 });
    expect(item.description).toBe('Service Item');
  });

  it('clamps quantity to a minimum of 1', () => {
    const item = processInvoiceItem({ description: 'x', quantity: 0, unitPrice: 100 });
    expect(item.quantity).toBe(1);
  });

  it('clamps negative unit price to 0', () => {
    const item = processInvoiceItem({ description: 'x', quantity: 1, unitPrice: -50 });
    expect(item.unitPrice).toBe(0);
    expect(item.amount).toBe(0);
  });

  it('computes amount as quantity * unitPrice, rounded to cents', () => {
    const item = processInvoiceItem({ description: 'Print', quantity: 3, unitPrice: 19.99 });
    expect(item.amount).toBe(59.97);
  });
});

describe('calculateInvoiceTotals', () => {
  it('applies Singapore 9% GST correctly on a multi-item invoice', () => {
    const result = calculateInvoiceTotals(
      [
        { description: 'Portrait session', quantity: 1, unitPrice: 500 },
        { description: 'Print', quantity: 3, unitPrice: 19.99 },
      ],
      { isGstApplied: true, gstRate: 9 }
    );

    expect(result.subtotal).toBe(559.97);
    expect(result.gstAmount).toBe(50.4); // 559.97 * 0.09 = 50.3973 -> 50.40
    expect(result.totalAmount).toBe(610.37);
  });

  it('skips GST entirely when isGstApplied is false, regardless of gstRate', () => {
    const result = calculateInvoiceTotals(
      [{ description: 'Portrait session', quantity: 1, unitPrice: 500 }],
      { isGstApplied: false, gstRate: 9 }
    );

    expect(result.gstRate).toBe(0);
    expect(result.gstAmount).toBe(0);
    expect(result.totalAmount).toBe(500);
  });

  it('never produces a negative subtotal even with malformed items', () => {
    const result = calculateInvoiceTotals(
      [{ description: 'Bad item', quantity: -5, unitPrice: -10 }],
      { isGstApplied: true, gstRate: 9 }
    );

    expect(result.items[0].quantity).toBe(1);
    expect(result.items[0].unitPrice).toBe(0);
    expect(result.subtotal).toBe(0);
  });
});
