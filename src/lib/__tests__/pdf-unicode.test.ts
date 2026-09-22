import { describe, it, expect } from 'vitest';
import { generateInvoicePDF, type InvoicePDFData } from '../pdf-generator';
import { generateContractPDF } from '../contract-pdf-generator';
import { splitRuns } from '../pdf-unicode';

const base: InvoicePDFData = {
  invoiceNumber: 'JSQ-2026-0002',
  issueDate: new Date('2026-03-01'),
  dueDate: new Date('2026-03-15'),
  status: 'SENT',
  paymentMethod: 'BANK_TRANSFER',
  subtotal: 788,
  isGstApplied: false,
  gstRate: 9,
  gstAmount: 0,
  totalAmount: 788,
  paidAmount: 0,
  balanceDue: 788,
  client: { companyName: 'Client' },
  projectTitle: 'Reflect 100 Look 200',
  items: [{ description: 'Photo Booth', quantity: 1, unitPrice: 788, amount: 788 }],
};

describe('names in other languages on PDFs', () => {
  it('plain English text never needs extra fonts', () => {
    expect(splitRuns('Hello World', []).every((r) => r.font === null)).toBe(true);
  });

  it('with no font available, unsupported characters become "?" instead of failing', () => {
    expect(splitRuns('回顾100', []).map((r) => r.text).join('')).toBe('??100');
  });

  it('an invoice with a Chinese title still generates and stays small', async () => {
    const english = await generateInvoicePDF(base);
    const chinese = await generateInvoicePDF({ ...base, projectTitle: '回顾100 展望200' });
    expect(Buffer.from(chinese.slice(0, 5)).toString('latin1')).toBe('%PDF-');
    // Only the few characters used are embedded (a few KB), never a whole font
    expect(chinese.length - english.length).toBeLessThan(60_000);
  });

  it('a contract with Chinese and Tamil names generates instead of throwing', async () => {
    const bytes = await generateContractPDF({
      title: 'Photography Agreement',
      contractBody: '1. Scope\nCoverage for 回顾100 展望200.',
      isSigned: false,
      client: { companyName: '新加坡华人文化协会', contactName: 'தமிழ்' },
      projectTitle: '回顾100 展望200',
      invoiceNumber: 'JSQ-2026-0002',
      totalAmount: 788,
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');
  });
});
