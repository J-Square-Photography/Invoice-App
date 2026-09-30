import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
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
  address: '',
  email: '',
  website: '',
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
/** All text drawn in a generated PDF (Montserrat is embedded as a subset with Identity-H encoding, so hex strings in the content stream are glyph IDs, not characters - pdfjs-dist reads them back via the font's ToUnicode CMap instead). */
async function pdfText(bytes: Uint8Array): Promise<string> {
  // pdfjs-dist transfers the buffer it's given, so pass a copy - the caller often reuses `bytes` afterwards (e.g. for pageCount).
  const doc = await getDocument({ data: bytes.slice(), useSystemFonts: true, isEvalSupported: false }).promise;
  let out = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    out += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
  }
  return out;
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
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { company: { ...COMPANY, gstRegNo: 'M90376150R' } } })));
    expect(text).toContain('Tax Invoice');
    expect(text).toContain('GST Reg No: M90376150R');
  });

  it('with no GST number set, the line is simply left out', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { company: { ...COMPANY, gstRegNo: '' } } })));
    expect(text).toContain('Tax Invoice');
    expect(text).not.toContain('GST Reg No');
  });

  it('shows the business and client addresses when set, and stays on one page', async () => {
    const bytes = await generateInvoicePDF(
      invoice({
        overrides: {
          company: { ...COMPANY, address: '123 Example Road, #01-23, Singapore 123456' },
          client: { companyName: 'PA', contactName: 'Maguire Lim', email: 'pa@example.com', address: '9 Client Street, #05-01, Singapore 654321' },
        },
      })
    );
    const text = await pdfText(bytes);
    expect(text).toContain('123 Example Road');
    expect(text).toContain('9 Client Street');
    expect(await pageCount(bytes)).toBe(1);
  });

  it('with no addresses, the header falls back to plain Singapore', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { company: { ...COMPANY, address: '' } } })));
    expect(text).toContain('Singapore');
  });

  it('a quotation is titled Quotation, asks for a reply, and has no payment details', async () => {
    const bytes = await generateInvoicePDF(
      invoice({ overrides: { documentType: 'QUOTE', invoiceNumber: 'QUO-2026-0001', status: 'DRAFT', company: { ...COMPANY, gstRegNo: 'M90376150R' } } })
    );
    const text = await pdfText(bytes);
    expect(text).toContain('Quotation');
    expect(text).toContain('QUO-2026-0001');
    expect(text).toContain('HOW TO ACCEPT');
    expect(text).toContain('QUOTED TOTAL');
    expect(text).not.toContain('Tax Invoice');
    expect(text).not.toContain('PAYMENT INSTRUCTIONS');
    expect(text).not.toContain('PAYMENT OPTIONS');
    expect(text).not.toContain('BALANCE DUE');
    expect(await pageCount(bytes)).toBe(1);
  });

  it('a no-charge line reads as Included instead of $0.00', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ items: [{ description: 'Photography', amount: 500 }, { description: 'Culling and editing', amount: 0 }] })));
    expect(text).toContain('Included');
  });

  it('a very long client name wraps and shrinks to fit instead of being cut off with "..."', async () => {
    const longName = 'Union of Telecommunications and Related Digital Services Employees of Singapore Pte Ltd';
    const longContact = 'A Very Long Contact Person Full Name Goes Right Here Indeed';
    const longEmail = 'somebody.with.a.remarkably.long.email.address@a-very-long-company-domain-name.example.com';
    const bytes = await generateInvoicePDF(
      invoice({
        overrides: {
          client: { companyName: longName, contactName: longContact, email: longEmail, phone: '+65 8888 8888', uen: '201912345A' },
        },
      })
    );
    // Wrapped text lands in separate Tj chunks (one per drawn line), so it comes back with a
    // newline wherever a line broke - including, for an unbreakable string like an email with no
    // spaces of its own, mid-word. Strip whitespace entirely before checking it's all still there.
    const squashed = (await pdfText(bytes)).replace(/\s+/g, '');
    expect(squashed).toContain(longName.replace(/\s+/g, ''));
    expect(squashed).toContain(longContact.replace(/\s+/g, ''));
    expect(squashed).toContain(longEmail.replace(/\s+/g, ''));
    expect(await pageCount(bytes)).toBe(1);
  });

  it('an invoice that does not charge GST is a plain Invoice', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { isGstApplied: false, gstAmount: 0, company: { ...COMPANY, gstRegNo: 'M90376150R' } } })));
    expect(text).not.toContain('Tax Invoice');
    expect(text).toContain('Invoice');
  });

  it('a draft invoice does not render a DRAFT status badge on client PDF', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { status: 'DRAFT' } })));
    expect(text).not.toContain('STATUS: DRAFT');
    expect(text).not.toContain('DRAFT');
    expect(text).not.toContain('STATUS:');
  });

  it('a sent invoice does not render a SENT status badge on client PDF', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { status: 'SENT' } })));
    expect(text).not.toContain('STATUS: SENT');
    expect(text).not.toContain('STATUS:');
  });

  it('a paid invoice renders the PAID status badge', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { status: 'PAID' } })));
    expect(text).toContain('PAID');
  });

  it('a partially paid invoice renders the PARTIAL status badge', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { status: 'PARTIAL' } })));
    expect(text).toContain('PARTIAL');
  });

  it('a void invoice renders the VOID status badge', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { status: 'VOID' } })));
    expect(text).toContain('VOID');
  });

  it('a draft or sent quotation does not render any status badge', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { documentType: 'QUOTE', invoiceNumber: 'QUO-2026-0001', status: 'DRAFT' } })));
    expect(text).not.toContain('STATUS: DRAFT');
    expect(text).not.toContain('DRAFT');
    expect(text).not.toContain('STATUS:');
  });

  it('an accepted quotation renders the ACCEPTED status badge', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { documentType: 'QUOTE', invoiceNumber: 'QUO-2026-0001', status: 'ACCEPTED' } })));
    expect(text).toContain('ACCEPTED');
  });

  it('a declined quotation renders the DECLINED status badge', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { documentType: 'QUOTE', invoiceNumber: 'QUO-2026-0001', status: 'DECLINED' } })));
    expect(text).toContain('DECLINED');
  });

  it('does not render company UEN in the top-right header block', async () => {
    const quoteText = await pdfText(await generateInvoicePDF(invoice({ overrides: { documentType: 'QUOTE', company: { ...COMPANY, uen: '202012345M' } } })));
    expect(quoteText).not.toContain('UEN: 202012345M');
  });

  it('does not render UNIT PRICE column in the items table', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice()));
    expect(text).not.toContain('UNIT PRICE');
  });

  it('renders PAYMENT OPTIONS and DBS PayLah!, OCBC, UOB, GrabPay, etc. on invoice', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice()));
    expect(text).toContain('PAYMENT OPTIONS');
    expect(text).toContain('DBS PayLah!, OCBC, UOB, GrabPay, etc.');
  });

  it('renders Deposit Given on the PDF when deposit is filled', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { depositAmount: 200 } })));
    expect(text).toContain('Deposit Given');
    expect(text).toContain('-$200.00');
  });

  it('does not render Deposit Given on the PDF when deposit is blank or 0', async () => {
    const text = await pdfText(await generateInvoicePDF(invoice({ overrides: { depositAmount: 0 } })));
    expect(text).not.toContain('Deposit Given');
  });
});
