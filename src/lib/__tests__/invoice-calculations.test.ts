import { describe, it, expect } from 'vitest';
import { roundCents, processInvoiceItem, calculateInvoiceTotals, processDiscounts, parseStoredDiscounts, describeDiscount } from '../invoice-calculations';

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

describe('processInvoiceItem with a typed line total', () => {
  it('uses the line total as entered and derives the unit price from it', () => {
    const item = processInvoiceItem({ description: 'Photobooth', quantity: 1, amount: 568 });
    expect(item.amount).toBe(568);
    expect(item.unitPrice).toBe(568);
  });

  it('keeps the typed total exact even when it does not divide evenly by the quantity', () => {
    const item = processInvoiceItem({ description: 'x', quantity: 3, amount: 100 });
    expect(item.amount).toBe(100);
    expect(item.unitPrice).toBe(33.33);
  });

  it('clamps a negative or invalid total to 0', () => {
    expect(processInvoiceItem({ description: 'x', quantity: 1, amount: -20 }).amount).toBe(0);
    expect(processInvoiceItem({ description: 'x', quantity: 1, amount: 'abc' }).amount).toBe(0);
  });

  it('totals use the typed line amounts', () => {
    const result = calculateInvoiceTotals(
      [
        { description: 'A', quantity: 1, amount: 368 },
        { description: 'B', quantity: 1, amount: 33.12 },
      ],
      { isGstApplied: true, gstRate: 9 }
    );
    expect(result.subtotal).toBe(401.12);
    expect(result.gstAmount).toBe(36.1);
    expect(result.totalAmount).toBe(437.22);
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

describe('discounts', () => {
  const line = [{ description: 'Package', quantity: 1, amount: 1000 }];

  it('applies discounts one after another in the order given, showing the price at each stage', () => {
    const result = calculateInvoiceTotals(line, {
      isGstApplied: false,
      gstRate: 9,
      discounts: [
        { name: 'Early bird', type: 'PERCENT', value: 10 },
        { name: 'Loyalty', type: 'FLAT', value: 50 },
        { name: 'Referral', type: 'PERCENT', value: 5 },
      ],
    });
    expect(result.discounts.map((d) => [d.priceBefore, d.amount, d.priceAfter])).toEqual([
      [1000, 100, 900],
      [900, 50, 850],
      [850, 42.5, 807.5],
    ]);
    expect(result.discountAmount).toBe(192.5);
    expect(result.totalAmount).toBe(807.5);
  });

  it('order matters: a flat discount before a percentage gives a different total', () => {
    const flatFirst = calculateInvoiceTotals(line, {
      isGstApplied: false,
      gstRate: 9,
      discounts: [{ type: 'FLAT', value: 100 }, { type: 'PERCENT', value: 10 }],
    });
    const percentFirst = calculateInvoiceTotals(line, {
      isGstApplied: false,
      gstRate: 9,
      discounts: [{ type: 'PERCENT', value: 10 }, { type: 'FLAT', value: 100 }],
    });
    expect(flatFirst.totalAmount).toBe(810);
    expect(percentFirst.totalAmount).toBe(800);
  });

  it('charges GST on the discounted amount, not the original subtotal', () => {
    const result = calculateInvoiceTotals(line, {
      isGstApplied: true,
      gstRate: 9,
      discounts: [{ type: 'PERCENT', value: 10 }],
    });
    expect(result.subtotal).toBe(1000);
    expect(result.taxableAmount).toBe(900);
    expect(result.gstAmount).toBe(81);
    expect(result.totalAmount).toBe(981);
  });

  it('never takes the price below zero', () => {
    const result = calculateInvoiceTotals(line, {
      isGstApplied: true,
      gstRate: 9,
      discounts: [{ type: 'FLAT', value: 5000 }, { type: 'PERCENT', value: 50 }],
    });
    expect(result.discounts[0].amount).toBe(1000);
    expect(result.taxableAmount).toBe(0);
    expect(result.gstAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('caps a percentage at 100 and ignores empty or negative discounts', () => {
    const d = processDiscounts(200, [
      { type: 'PERCENT', value: 250 },
      { type: 'FLAT', value: 0 },
      { type: 'FLAT', value: -20 },
    ]);
    expect(d).toHaveLength(1);
    expect(d[0].value).toBe(100);
    expect(d[0].amount).toBe(200);
  });

  it('names an unnamed discount sensibly and keeps cents exact', () => {
    const d = processDiscounts(333.33, [{ type: 'PERCENT', value: 12.5 }, { type: 'FLAT', value: 10.555 }]);
    expect(d[0].name).toBe('Discount');
    expect(d[0].amount).toBe(41.67);
    expect(d[1].name).toBe('Discount');
    expect(d[1].amount).toBe(10.56);
  });

  it('with no discounts nothing changes', () => {
    const result = calculateInvoiceTotals(line, { isGstApplied: true, gstRate: 9 });
    expect(result.discounts).toEqual([]);
    expect(result.discountAmount).toBe(0);
    expect(result.totalAmount).toBe(1090);
  });

  it('reads stored discounts back, ignoring junk', () => {
    expect(parseStoredDiscounts(null)).toEqual([]);
    expect(parseStoredDiscounts([{ name: 'A', type: 'FLAT', value: 5 }, 'x', null])).toEqual([
      { name: 'A', type: 'FLAT', value: 5 },
    ]);
  });
});
describe('describeDiscount (client-facing wording)', () => {
  it('names a discount with what it takes off', () => {
    expect(describeDiscount({ name: 'Early bird', type: 'PERCENT', value: 10 })).toBe('Early bird (10% off)');
    expect(describeDiscount({ name: 'Loyalty', type: 'FLAT', value: 100 })).toBe('Loyalty ($100.00 off)');
  });

  it('an unnamed discount is just "Discount", without repeating the percentage', () => {
    expect(describeDiscount({ name: '', type: 'PERCENT', value: 10 })).toBe('Discount (10% off)');
    expect(describeDiscount({ type: 'FLAT', value: 100 })).toBe('Discount ($100.00 off)');
  });

  it('cleans up generic names saved by older invoices', () => {
    expect(describeDiscount({ name: '10% discount', type: 'PERCENT', value: 10 })).toBe('Discount (10% off)');
    expect(describeDiscount({ name: 'Discount', type: 'FLAT', value: 100 })).toBe('Discount ($100.00 off)');
  });

  it('keeps decimal percentages readable', () => {
    expect(describeDiscount({ name: 'Promo', type: 'PERCENT', value: 12.5 })).toBe('Promo (12.5% off)');
  });
});