import { describe, it, expect } from 'vitest';
import { generateInvoicePDF, type InvoicePDFData } from '../pdf-generator';
import { calculateInvoiceTotals } from '../invoice-calculations';

function invoiceWith(discounts: Array<{ name?: string; type: string; value: number }>): InvoicePDFData {
  const totals = calculateInvoiceTotals([{ description: 'Photobooth package', quantity: 1, amount: 1000 }], {
    isGstApplied: true,
    gstRate: 9,
    discounts,
  });
  return {
    invoiceNumber: 'JSQ-2026-0099',
    issueDate: new Date('2026-09-21'),
    dueDate: new Date('2026-10-05'),
    status: 'SENT',
    paymentMethod: 'PAYNOW_QR',
    subtotal: totals.subtotal,
    discounts: totals.discounts,
    discountAmount: totals.discountAmount,
    isGstApplied: true,
    gstRate: 9,
    gstAmount: totals.gstAmount,
    totalAmount: totals.totalAmount,
    paidAmount: 0,
    balanceDue: totals.totalAmount,
    client: { companyName: 'PA', contactName: 'Maguire Lim', email: 'pa@example.com' },
    projectTitle: 'School',
    items: totals.items,
  };
}

const isPdf = (bytes: Uint8Array) => Buffer.from(bytes.slice(0, 5)).toString('latin1') === '%PDF-';

describe('invoice PDF with discounts', () => {
  it('renders an invoice with no discounts', async () => {
    const bytes = await generateInvoicePDF(invoiceWith([]));
    expect(isPdf(bytes)).toBe(true);
  });

  it('renders several stacked discounts, including a very long name', async () => {
    const bytes = await generateInvoicePDF(
      invoiceWith([
        { name: 'Early bird', type: 'PERCENT', value: 10 },
        { name: 'Loyal returning corporate client anniversary special', type: 'FLAT', value: 50 },
        { name: 'Referral', type: 'PERCENT', value: 5 },
      ])
    );
    expect(isPdf(bytes)).toBe(true);
    expect(bytes.length).toBeGreaterThan(2000);
  });

  it('a discount PDF is larger than the same invoice without discounts (the lines were drawn)', async () => {
    const plain = await generateInvoicePDF(invoiceWith([]));
    const discounted = await generateInvoicePDF(invoiceWith([{ name: 'Early bird', type: 'PERCENT', value: 10 }]));
    expect(discounted.length).toBeGreaterThan(plain.length);
  });
});
