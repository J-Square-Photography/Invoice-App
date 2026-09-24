import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generatePayslipPDF, type PayslipPDFData } from '../payslip-generator';

const COMPANY = {
  companyName: 'J Square Photography',
  uen: '202012345M',
  bankName: 'DBS Bank Ltd',
  bankAccountNumber: '012-345678-9',
  bankBranchCode: '012',
  bankAccountName: 'J SQUARE PHOTOGRAPHY',
  gstRegNo: '',
  address: '',
  isGstRegistered: true,
  gstRate: 9,
};

function payslip(overrides: Partial<PayslipPDFData> = {}): PayslipPDFData {
  return {
    payslipNumber: 'PS-2026-ABC123',
    paymentDate: new Date('2026-09-30'),
    periodStart: new Date('2026-09-01'),
    periodEnd: new Date('2026-09-30'),
    staff: { name: 'Tan Wei Ming', type: 'PT', email: 'wei@example.com', bankName: 'DBS', bankAccountNumber: '123-456', payNowNumber: null },
    totalHours: 40,
    regularHours: 40,
    overtimeHours: 0,
    hourlyRate: 20,
    basicPay: 800,
    overtimePay: 0,
    allowances: [],
    deductions: [],
    netPay: 800,
    status: 'DRAFT',
    company: COMPANY,
    ...overrides,
  };
}

const pageCount = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe('payslip PDF', () => {
  it('generates a valid one-page PDF for a plain part-time payslip', async () => {
    const bytes = await generatePayslipPDF(payslip());
    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');
    expect(await pageCount(bytes)).toBe(1);
  });

  it('includes overtime as its own line when present', async () => {
    const bytes = await generatePayslipPDF(
      payslip({ totalHours: 45, regularHours: 40, overtimeHours: 5, overtimePay: 150, netPay: 950 })
    );
    expect(await pageCount(bytes)).toBe(1);
  });

  it('handles allowances and deductions together', async () => {
    const bytes = await generatePayslipPDF(
      payslip({
        allowances: [{ label: 'Transport', amount: 50 }, { label: 'Meal', amount: 30 }],
        deductions: [{ label: 'Unpaid leave', amount: 40 }],
        netPay: 840,
      })
    );
    expect(await pageCount(bytes)).toBe(1);
  });

  it('does not break on a freelancer with no bank details, only PayNow', async () => {
    const bytes = await generatePayslipPDF(
      payslip({ staff: { name: 'Jane Freelancer', type: 'FREELANCE', email: null, bankName: null, bankAccountNumber: null, payNowNumber: '91234567' } })
    );
    expect(await pageCount(bytes)).toBe(1);
  });

  it('shrinks or wraps a very long staff name instead of breaking', async () => {
    const bytes = await generatePayslipPDF(
      payslip({ staff: { name: 'Muhammad Firdaus Bin Abdul Rahman Al-Haddad Extra Long Name', type: 'PT', email: null, bankName: null, bankAccountNumber: null, payNowNumber: null } })
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString('latin1')).toBe('%PDF-');
    expect(await pageCount(bytes)).toBe(1);
  });

  it('marks a paid payslip with the PAID status badge without erroring', async () => {
    const bytes = await generatePayslipPDF(payslip({ status: 'PAID' }));
    expect(await pageCount(bytes)).toBe(1);
  });
});
