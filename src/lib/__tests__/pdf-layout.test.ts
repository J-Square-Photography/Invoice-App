import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { inflateSync } from 'zlib';
import { generateInvoicePDF, type InvoicePDFData } from '../pdf-generator';
import { calculateInvoiceTotals } from '../invoice-calculations';

const COMPANY = {
  companyName: 'J Square Photography',
  uen: '202012345M',
  bankName: 'DBS Bank Ltd',
  bankAccountNumber: '012-345678-9',
  bankBranchCode: '012',
  bankAccountName: 'J SQUARE PHOTOGRAPHY',
  gstRegNo: '',
  isGstRegistered: true,
  gstRate: 9,
};

type RawDiscount = { name: string; type: string; value: number };
type Options = {
  items?: Array<{ description: string; amount: number }>;
  rawDiscounts?: RawDiscount[];
  overrides?: Partial<Omit<InvoicePDFData, 'items' | 'discounts'>>;
};

function invoice({ items = [{ description: 'Event Photography (Novice, 3 hours)', amount: 180 }], rawDiscounts, overrides }: Options = {}): InvoicePDFData {
  const totals = calculateInvoiceTotals(
    items.map((i) => ({ description: i.description, quantity: 1, amount: i.amount })),
    { isGstApplied: true, gstRate: 9, discounts: rawDiscounts }
  );
  return {
    invoiceNumber: 'JSQ-2026-0100',
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
    ...overrides,
    items: totals.items,
  };
}
/** All text drawn in a generated PDF (the standard fonts store it as hex strings in compressed streams). */
function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  const s = raw.toString('latin1');
  const out: string[] = [];
  let i = 0;
  while ((i = s.indexOf('stream', i)) !== -1) {
    const a = s.indexOf('\n', i) + 1;
    const b = s.indexOf('endstream', a);
    if (a < 1 || b < 0) break;
    try {
      const content = inflateSync(raw.subarray(a, b)).toString('latin1');
      for (const m of content.matchAll(/<([0-9A-Fa-f]+)> Tj/g)) out.push(Buffer.from(m[1], 'hex').toString('latin1'));
    } catch {
      // not a content stream
    }
    i = b + 9;
  }
  return out.join('\n');
}

const pageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe('invoice PDF layout', () => {
  it('a normal invoice fits on one page', async () => {
    expect(await pageCount(await generateInvoicePDF(invoice()))).toBe(1);
  });

  it('a short invoice with notes, phone number and a long project title still renders on one page', async () => {
    const bytes = await generateInvoicePDF(
      invoice({
        overrides: {
          notes: '50% deposit required on booking. Balance due upon delivery of the final edited files. '.repeat(3),
          projectTitle: 'School Fair 2026 - Photography and Videography Coverage for the Whole Weekend Programme',
          client: { companyName: 'PA', contactName: 'Maguire Lim Wei Bin', email: 'hawkfalcon063@gmail.com', phone: '+65 8931 2478', uen: '123245676890-09865' },
        },
      })
    );
    expect(await pageCount(bytes)).toBe(1);
  });

  it('a long invoice flows onto extra pages instead of running off the bottom', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ description: `Line item ${i + 1}: add-on package`, amount: 40 }));
    expect(await pageCount(await generateInvoicePDF(invoice({ items: many })))).toBeGreaterThanOrEqual(2);
  });

  it('long descriptions wrap onto extra lines without breaking', async () => {
    const bytes = await generateInvoicePDF(
      invoice({ items: [{ description: 'Event Photography (Enthusiast, 7 hours) including edited high-resolution digital delivery within two weeks of the event date '.repeat(2), amount: 800 }] })
    );
    expect(await pageCount(bytes)).toBe(1);
  });

  it('names with characters the standard PDF fonts cannot draw no longer break generation', async () => {
    const bytes = await generateInvoicePDF(
      invoice({
        overrides: {
          client: { companyName: '你好 Studio \u{1F4F8}', contactName: '李明', email: 'li@example.com' },
          projectTitle: '婚礼 – Wedding',
        },
      })
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');
  });

  it('many discounts still fit alongside the totals', async () => {
    const bytes = await generateInvoicePDF(
      invoice({
        rawDiscounts: Array.from({ length: 6 }, (_, i) => ({ name: `Promo ${i + 1}`, type: 'PERCENT', value: 2 })),
      })
    );
    expect(await pageCount(bytes)).toBeLessThanOrEqual(2);
  });

  it('a GST invoice is titled "Tax Invoice" and shows the GST registration number', async () => {
    const text = pdfText(await generateInvoicePDF(invoice({ overrides: { company: { ...COMPANY, gstRegNo: 'M90376150R' } } })));
    expect(text).toContain('Tax Invoice');
    expect(text).toContain('GST Reg No: M90376150R');
  });

  it('with no GST number set, the line is simply left out', async () => {
    const text = pdfText(await generateInvoicePDF(invoice({ overrides: { company: { ...COMPANY, gstRegNo: '' } } })));
    expect(text).toContain('Tax Invoice');
    expect(text).not.toContain('GST Reg No');
  });

  it('an invoice that does not charge GST is a plain Invoice', async () => {
    const text = pdfText(await generateInvoicePDF(invoice({ overrides: { isGstApplied: false, gstAmount: 0, company: { ...COMPANY, gstRegNo: 'M90376150R' } } })));
    expect(text).not.toContain('Tax Invoice');
    expect(text).toContain('Invoice');
  });
});
