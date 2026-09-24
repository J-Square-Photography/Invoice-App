import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { defaultPaymentConfig, type CompanyPaymentConfig } from './payment-config';
import { STAFF_TYPE_LABELS, type StaffType } from './staff-types';
import type { PayGroupBreakdown } from './timesheet-calculations';

export interface PayslipPDFData {
  payslipNumber: string;
  paymentDate: string | Date;
  periodStart: string | Date;
  periodEnd: string | Date;
  staff: {
    name: string;
    type: StaffType;
    email?: string | null;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    payNowNumber?: string | null;
  };
  /** One row per discipline/rate worked in the period - a staff member paid at more than one rate
   * (different disciplines, or a rate-card change mid-period) gets one Basic Pay + Overtime Pay
   * line per group, each showing its own hours x rate, rather than one blended figure. */
  breakdown: PayGroupBreakdown[];
  basicPay: number;
  overtimePay: number;
  allowances: Array<{ label: string; amount: number }>;
  deductions: Array<{ label: string; amount: number }>;
  netPay: number;
  status: string;
  company?: CompanyPaymentConfig;
}

/**
 * A downloadable PDF payslip for a part-timer/freelancer, itemised in line with typical Singapore
 * MOM itemised payslip requirements: employer/employee details, the exact salary period, the basic
 * pay calculation (hours x rate), overtime as its own line, allowances/deductions each itemised,
 * and the final net pay.
 */
export async function generatePayslipPDF(data: PayslipPDFData): Promise<Uint8Array> {
  const cfg = data.company ?? defaultPaymentConfig;
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  type Font = typeof fontRegular;
  type Colour = ReturnType<typeof rgb>;

  const black = rgb(0.1, 0.1, 0.1);
  const darkGray = rgb(0.3, 0.3, 0.3);
  const lightGray = rgb(0.55, 0.55, 0.55);
  const STRONG = rgb(0.22, 0.22, 0.22);
  const SOFT = rgb(0.86, 0.86, 0.86);
  const TINT = rgb(0.955, 0.955, 0.955);
  const accentRed = rgb(0.48, 0.07, 0.08);
  const accentTint = rgb(0.985, 0.94, 0.94);
  const green = rgb(0.1, 0.6, 0.2);
  const white = rgb(1, 1, 1);

  const [W, H] = PageSizes.A4;
  const M = 50;
  const RIGHT = W - M;
  const CW = RIGHT - M;
  const FOOTER_Y = 45;
  const EDGE = 1.25;
  const RULE = 0.6;

  const page = pdfDoc.addPage(PageSizes.A4);

  const measure = (s: string, size: number, font: Font) => font.widthOfTextAtSize(s, size);
  const fitSize = (s: string, naturalSize: number, font: Font, maxWidth: number, minSize = 7): { text: string; size: number } => {
    let size = naturalSize;
    while (size > minSize && measure(s, size, font) > maxWidth) size -= 0.5;
    if (measure(s, size, font) <= maxWidth) return { text: s, size };
    let out = s;
    while (out.length > 1 && measure(out, size, font) > maxWidth) out = out.slice(0, -1);
    return { text: out === s ? out : `${out.trimEnd()}...`, size };
  };
  const text = (s: string, x: number, y: number, size: number, font: Font, color: Colour) =>
    page.drawText(s, { x, y, size, font, color });
  const textRight = (s: string, xRight: number, y: number, size: number, font: Font, color: Colour) =>
    text(s, xRight - measure(s, size, font), y, size, font, color);
  const hLine = (x1: number, x2: number, y: number, thickness: number, color: Colour) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  const fillBox = (x: number, yBottom: number, w: number, h: number, color: Colour) =>
    page.drawRectangle({ x, y: yBottom, width: w, height: h, color });
  const edgeBox = (x: number, yBottom: number, w: number, h: number, color: Colour = STRONG, thickness = EDGE) =>
    page.drawRectangle({ x, y: yBottom, width: w, height: h, borderColor: color, borderWidth: thickness });
  const money = (n: number) => `$${n.toFixed(2)}`;
  const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' });

  // ============ HEADER ============
  fillBox(M, H - 48, CW, 8, accentRed);
  const studioName = fitSize(cfg.companyName.toUpperCase(), 20, fontBold, CW - 230, 11);
  text(studioName.text, M, H - 82, studioName.size, fontBold, black);
  text('PHOTOGRAPHY  ·  VIDEOGRAPHY  ·  PHOTOBOOTH', M, H - 96, 7.5, fontRegular, lightGray);
  textRight(`UEN: ${cfg.uen}`, RIGHT, H - 72, 8.5, fontRegular, darkGray);
  textRight('contact@jsquarephotography.com', RIGHT, H - 83, 8.5, fontRegular, darkGray);

  text('Payslip', M, H - 140, 24, fontBold, black);
  text(`Payment date: ${fmtDate(data.paymentDate)}`, M, H - 154, 8.5, fontRegular, darkGray);
  textRight(`Payslip #${data.payslipNumber}`, RIGHT, H - 134, 12, fontBold, black);
  const statusColor = data.status === 'PAID' ? green : accentRed;
  const statusLabel = `STATUS: ${data.status}`;
  const badgeW = measure(statusLabel, 8, fontBold) + 18;
  fillBox(RIGHT - badgeW, H - 160, badgeW, 16, statusColor);
  textRight(statusLabel, RIGHT - 9, H - 155, 8, fontBold, white);

  hLine(M, RIGHT, H - 174, RULE, SOFT);

  // ============ EMPLOYEE / PERIOD STRIP ============
  const stripTop = H - 188;
  const stripH = 90;
  const c1 = 260;
  const x2 = M + c1;
  edgeBox(M, stripTop - stripH, CW, stripH);
  page.drawLine({ start: { x: x2, y: stripTop }, end: { x: x2, y: stripTop - stripH }, thickness: RULE, color: SOFT });

  const label = (s: string, x: number, y: number) => text(s, x, y, 7.5, fontBold, accentRed);
  label('EMPLOYEE', M + 10, stripTop - 15);
  const nameFit = fitSize(data.staff.name, 12, fontBold, c1 - 20, 8);
  text(nameFit.text, M + 10, stripTop - 31, nameFit.size, fontBold, black);
  text(STAFF_TYPE_LABELS[data.staff.type], M + 10, stripTop - 44, 9, fontRegular, darkGray);
  let ey = stripTop - 58;
  if (data.staff.email) {
    text(fitSize(`Email: ${data.staff.email}`, 8.5, fontRegular, c1 - 20, 6.5).text, M + 10, ey, 8.5, fontRegular, darkGray);
    ey -= 11;
  }
  if (data.staff.bankName && data.staff.bankAccountNumber) {
    text(
      fitSize(`Bank: ${data.staff.bankName} ${data.staff.bankAccountNumber}`, 8.5, fontRegular, c1 - 20, 6.5).text,
      M + 10,
      ey,
      8.5,
      fontRegular,
      darkGray
    );
    ey -= 11;
  } else if (data.staff.payNowNumber) {
    text(fitSize(`PayNow: ${data.staff.payNowNumber}`, 8.5, fontRegular, c1 - 20, 6.5).text, M + 10, ey, 8.5, fontRegular, darkGray);
  }

  label('SALARY PERIOD', x2 + 10, stripTop - 15);
  text(fmtDate(data.periodStart), x2 + 10, stripTop - 31, 11, fontBold, black);
  text('to', x2 + 10, stripTop - 44, 8.5, fontRegular, lightGray);
  text(fmtDate(data.periodEnd), x2 + 10, stripTop - 57, 11, fontBold, black);

  // ============ HOURS & BASIC PAY ============
  let y = stripTop - stripH - 24;
  text('HOURS WORKED', M, y, 10, fontBold, accentRed);
  y -= 18;

  const HEADER_H = 20;
  // Description | Hours | Rate | Amount, laid out by explicit column dividers (rather than a fixed
  // offset from the description column) so the Rate and Amount columns never crowd each other -
  // they used to sit only ~27pt apart and would visually overlap once both were right-aligned.
  const descW = 230;
  const col1X = M + descW; // divider: description | hours
  const col2X = col1X + 85; // divider: hours | rate
  const col3X = col2X + 85; // divider: rate | amount

  fillBox(M, y - HEADER_H, CW, HEADER_H, TINT);
  text('DESCRIPTION', M + 8, y - 14, 8, fontBold, black);
  textRight('HOURS', col2X - 8, y - 14, 8, fontBold, black);
  textRight('RATE', col3X - 8, y - 14, 8, fontBold, black);
  textRight('AMOUNT (SGD)', RIGHT - 8, y - 14, 8, fontBold, black);
  y -= HEADER_H;

  // The Hours and Rate columns already show the math, so the description just names what's being
  // paid (e.g. "Photography (Enthusiast)" or "Photobooth: Main (Package A)") rather than repeating
  // hours x rate a second time.
  const rows: Array<{ desc: string; hours: string; rate: string; amount: number }> = [];
  for (const group of data.breakdown) {
    if (group.regularHours > 0) {
      rows.push({
        desc: `Basic Pay – ${group.group}`,
        hours: group.regularHours.toFixed(2),
        rate: money(group.hourlyRate),
        amount: group.basicPay,
      });
    }
    if (group.overtimeHours > 0) {
      rows.push({
        desc: `Overtime Pay – ${group.group}`,
        hours: group.overtimeHours.toFixed(2),
        rate: money(group.hourlyRate * 1.5),
        amount: group.overtimePay,
      });
    }
  }

  const rowTop = y;
  for (const row of rows) {
    text(fitSize(row.desc, 9, fontRegular, descW - 16, 7).text, M + 8, y - 15, 9, fontRegular, black);
    textRight(row.hours, col2X - 8, y - 15, 9, fontRegular, darkGray);
    textRight(row.rate, col3X - 8, y - 15, 9, fontRegular, darkGray);
    textRight(money(row.amount), RIGHT - 8, y - 15, 9, fontBold, black);
    y -= 24;
    hLine(M, RIGHT, y, RULE, SOFT);
  }
  edgeBox(M, y, CW, rowTop - y + HEADER_H);
  hLine(M, RIGHT, rowTop, EDGE, STRONG);
  for (const x of [col1X, col2X, col3X]) page.drawLine({ start: { x, y: rowTop + HEADER_H }, end: { x, y }, thickness: RULE, color: SOFT });

  y -= 20;

  // ============ ALLOWANCES / DEDUCTIONS / NET PAY ============
  const TW = 280;
  const TX = RIGHT - TW;
  type TotalsRow = { label: string; value: string; kind: 'normal' | 'deduction' | 'bold' | 'net' };
  const totalsRows: TotalsRow[] = [];
  totalsRows.push({ label: 'Basic Pay', value: money(data.basicPay), kind: 'normal' });
  if (data.overtimePay > 0) totalsRows.push({ label: 'Overtime Pay', value: money(data.overtimePay), kind: 'normal' });
  for (const a of data.allowances) totalsRows.push({ label: a.label, value: money(a.amount), kind: 'normal' });
  const grossPay = data.basicPay + data.overtimePay + data.allowances.reduce((s, a) => s + a.amount, 0);
  totalsRows.push({ label: 'Gross Pay', value: money(grossPay), kind: 'bold' });
  for (const d of data.deductions) totalsRows.push({ label: d.label, value: `-${money(d.amount)}`, kind: 'deduction' });
  totalsRows.push({ label: 'NET SALARY (SGD)', value: money(data.netPay), kind: 'net' });

  const rowHeight = (k: TotalsRow['kind']) => (k === 'net' ? 26 : 19);
  const totalsH = totalsRows.reduce((sum, r) => sum + rowHeight(r.kind), 0);

  if (y - totalsH < FOOTER_Y + 20) {
    // Extremely unlikely (many allowance/deduction lines), but keep the layout honest
    y = H - 60;
  }

  let ty = y;
  for (const r of totalsRows) {
    const h = rowHeight(r.kind);
    if (r.kind === 'net') fillBox(TX, ty - h, TW, h, accentTint);
    if (r.kind === 'bold') fillBox(TX, ty - h, TW, h, TINT);
    const baseline = ty - h / 2 - 3;
    if (r.kind === 'net') {
      text(r.label, TX + 10, baseline, 9.5, fontBold, accentRed);
      textRight(r.value, RIGHT - 10, baseline, 12, fontBold, accentRed);
    } else if (r.kind === 'bold') {
      text(r.label, TX + 10, baseline, 9, fontBold, darkGray);
      textRight(r.value, RIGHT - 10, baseline, 9, fontBold, black);
    } else if (r.kind === 'deduction') {
      text(r.label, TX + 10, baseline, 9, fontRegular, darkGray);
      textRight(r.value, RIGHT - 10, baseline, 9, fontRegular, accentRed);
    } else {
      text(r.label, TX + 10, baseline, 9, fontRegular, darkGray);
      textRight(r.value, RIGHT - 10, baseline, 9, fontRegular, black);
    }
    ty -= h;
    if (r !== totalsRows[totalsRows.length - 1]) {
      const next = totalsRows[totalsRows.indexOf(r) + 1];
      hLine(TX, RIGHT, ty, next.kind === 'net' ? EDGE : RULE, next.kind === 'net' ? STRONG : SOFT);
    }
  }
  edgeBox(TX, y - totalsH, TW, totalsH);

  // ============ FOOTER ============
  hLine(M, RIGHT, FOOTER_Y + 15, RULE, SOFT);
  text(`Generated by ${cfg.companyName}. This is a computer-generated payslip.`, M, FOOTER_Y, 8, fontRegular, lightGray);
  const pageLabel = 'Page 1 of 1';
  page.drawText(pageLabel, { x: RIGHT - fontRegular.widthOfTextAtSize(pageLabel, 8), y: FOOTER_Y, size: 8, font: fontRegular, color: lightGray });

  return pdfDoc.save();
}
