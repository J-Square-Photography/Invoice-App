import { PDFDocument, rgb, PageSizes } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { defaultPaymentConfig, type CompanyPaymentConfig } from './payment-config';
import { generatePayNowPayload, generatePayNowQRDataURL } from './sgqr';
import { discountName, discountTerms } from './invoice-calculations';
import { loadUnicodeFonts, splitRuns } from './pdf-unicode';

/** Brand typeface (J Square Brand Guide: Montserrat). Read once per warm serverless instance. */
const FONT_DIR = join(process.cwd(), 'src', 'lib', 'fonts');
let montserrat: { regular: Uint8Array; bold: Uint8Array; italic: Uint8Array } | null = null;
function loadMontserrat() {
  if (!montserrat) {
    montserrat = {
      regular: new Uint8Array(readFileSync(join(FONT_DIR, 'Montserrat-Regular.ttf'))),
      bold: new Uint8Array(readFileSync(join(FONT_DIR, 'Montserrat-Bold.ttf'))),
      italic: new Uint8Array(readFileSync(join(FONT_DIR, 'Montserrat-Italic.ttf'))),
    };
  }
  return montserrat;
}

/** The J Square wordmark drawn in the header; null (text fallback) if the file can't be read. */
const LOGO_PATH = join(process.cwd(), 'src', 'lib', 'brand', 'logo-wordmark.png');
let logoBytes: Uint8Array | null | undefined;
function loadLogo() {
  if (logoBytes === undefined) {
    try {
      logoBytes = new Uint8Array(readFileSync(LOGO_PATH));
    } catch (err) {
      console.error('Failed to read PDF logo, falling back to text:', err);
      logoBytes = null;
    }
  }
  return logoBytes;
}

export interface InvoicePDFData {
  /** Quotations reuse this layout: no payment details or QR, and dueDate is the valid-until date. */
  documentType?: 'INVOICE' | 'QUOTE';
  /** The invoice number, or the quotation number for a quote. */
  invoiceNumber: string;
  issueDate: string | Date;
  dueDate: string | Date;
  status: string;
  paymentMethod: string | null;
  subtotal: number;
  /** Discounts in the order applied (each with the dollars it took off). */
  discounts?: Array<{ name: string; type: string; value: number; amount: number }>;
  discountAmount?: number;
  isGstApplied: boolean;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  notes?: string | null;
  client: {
    companyName: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    uen?: string | null;
    address?: string | null;
  };
  projectTitle: string;
  /** Company/payment details from Settings. Falls back to the environment defaults. */
  company?: CompanyPaymentConfig & { staticQrDataUrl?: string | null };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

class SkipQr extends Error {}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Uint8Array> {
  const cfg = data.company ?? defaultPaymentConfig;
  const isQuote = data.documentType === 'QUOTE';
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const mont = loadMontserrat();
  // Subsetting reads and mutates decoded font state, so each document gets its own copy of the bytes
  // rather than sharing the cached Uint8Array across every PDF generated in this process.
  const fontRegular = await pdfDoc.embedFont(mont.regular.slice(), { subset: true });
  const fontBold = await pdfDoc.embedFont(mont.bold.slice(), { subset: true });
  const fontOblique = await pdfDoc.embedFont(mont.italic.slice(), { subset: true });
  type Font = typeof fontRegular;
  type Colour = ReturnType<typeof rgb>;

  // --- Look: the J Square brand system (Ink / Brass), with bold outer edges and soft inner lines ---
  const ink = rgb(14 / 255, 14 / 255, 13 / 255); // brand Ink #0E0E0D - headings, body text, strong fills
  const slate = rgb(0.32, 0.31, 0.29); // secondary text (dates, contact info, bank details)
  const faint = rgb(0.58, 0.57, 0.54); // tertiary text (footer, page numbers)
  const STRONG = rgb(0.2, 0.19, 0.18); // bold outer edges
  const SOFT = rgb(0.85, 0.84, 0.81); // soft but visible dividers
  const TINT = rgb(0.955, 0.953, 0.948);
  const brass = rgb(199 / 255, 154 / 255, 78 / 255); // brand Brass #C79A4E - the one focal accent per page
  const brassTint = rgb(0.978, 0.96, 0.93);
  const green = rgb(0.1, 0.6, 0.2); // PAID status - a universal payment colour, kept outside the brand palette
  const white = rgb(1, 1, 1);

  const [W, H] = PageSizes.A4; // 595.28 x 841.89 pt
  const M = 50; // page margin
  const RIGHT = W - M;
  const CW = RIGHT - M; // content width
  const FOOTER_Y = 45;
  const EDGE = 1.25; // outer edge thickness
  const RULE = 0.6; // inner divider thickness

  let page = pdfDoc.addPage(PageSizes.A4);
  const pages = [page];
  const newPage = () => {
    page = pdfDoc.addPage(PageSizes.A4);
    pages.push(page);
  };

  // --- Small drawing helpers ---
  // The standard PDF fonts can't draw every character (e.g. Chinese names); swap those for "?" instead of failing
  // Names in other languages are drawn with a small embedded Noto subset (see pdf-unicode.ts);
  // anything still unavailable becomes "?" rather than failing.
  const fallbacks = await loadUnicodeFonts(pdfDoc, [
    data.projectTitle,
    data.notes,
    data.client.companyName,
    data.client.contactName,
    data.client.email,
    data.client.phone,
    data.client.uen,
    data.client.address,
    cfg.companyName,
    cfg.address,
    cfg.bankName,
    cfg.bankAccountName,
    ...data.items.map((i) => i.description),
    ...(data.discounts ?? []).map((d) => d.name),
  ]);
  const measure = (s: string, size: number, font: Font) =>
    splitRuns(s, fallbacks).reduce((w, r) => w + (r.font ?? font).widthOfTextAtSize(r.text, size), 0);
  const fit = (s: string, size: number, font: Font, maxWidth: number) => {
    let out = s;
    while (out.length > 1 && measure(out, size, font) > maxWidth) out = out.slice(0, -1);
    return out === s ? out : `${out.trimEnd()}...`;
  };
  /** Like `fit`, but for text that must never be cut short (a client's name on an invoice): shrinks
   * the font size in half-point steps instead of the text, down to `minSize`, so a long name stays
   * fully legible just smaller rather than truncated with "...". Only falls back to truncating if
   * even `minSize` doesn't fit (a name so long no reasonable size would help). */
  const fitSize = (s: string, naturalSize: number, font: Font, maxWidth: number, minSize = 7): { text: string; size: number } => {
    let size = naturalSize;
    while (size > minSize && measure(s, size, font) > maxWidth) size -= 0.5;
    if (measure(s, size, font) <= maxWidth) return { text: s, size };
    return { text: fit(s, size, font, maxWidth), size };
  };
  /** For a client's name: shrinks to fit one line first (like `fitSize`), and if it's still too
   * wide even at `minSize`, wraps across up to `maxLines` lines at that size instead of cutting it
   * short. Only truncates with "..." as an absolute last resort, when even that doesn't fit. */
  const fitNameBlock = (
    s: string,
    naturalSize: number,
    font: Font,
    maxWidth: number,
    minSize: number,
    maxLines: number
  ): { lines: string[]; size: number } => {
    let size = naturalSize;
    while (size > minSize && measure(s, size, font) > maxWidth) size -= 0.5;
    if (measure(s, size, font) <= maxWidth) return { lines: [s], size };

    size = minSize;
    const wrapped = wrap(s, size, font, maxWidth);
    if (wrapped.length <= maxLines) return { lines: wrapped, size };

    const lines = wrapped.slice(0, maxLines);
    lines[maxLines - 1] = fit(`${lines[maxLines - 1]} ${wrapped.slice(maxLines).join(' ')}`, size, font, maxWidth);
    return { lines, size };
  };
  const wrap = (s: string, size: number, font: Font, maxWidth: number): string[] => {
    const words = s.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const trial = current ? `${current} ${word}` : word;
      if (measure(trial, size, font) <= maxWidth) {
        current = trial;
      } else {
        if (current) lines.push(current);
        current = '';
        if (measure(word, size, font) <= maxWidth) {
          current = word;
        } else {
          // A single "word" too wide for a whole line on its own - Chinese/Japanese text with no
          // spaces, or a long email/URL with nowhere else to break - is broken between characters
          // instead of being cut off, so nothing is ever silently lost to an ellipsis here.
          for (const ch of Array.from(word)) {
            if (current && measure(current + ch, size, font) > maxWidth) {
              lines.push(current);
              current = '';
            }
            current += ch;
          }
        }
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  };
  const drawOn = (p: typeof page, s: string, x: number, y: number, size: number, font: Font, color: Colour) => {
    let cx = x;
    for (const r of splitRuns(s, fallbacks)) {
      const f = r.font ?? font;
      p.drawText(r.text, { x: cx, y, size, font: f, color });
      cx += f.widthOfTextAtSize(r.text, size);
    }
  };
  const text = (s: string, x: number, y: number, size: number, font: Font, color: Colour) =>
    drawOn(page, s, x, y, size, font, color);
  const textRight = (s: string, xRight: number, y: number, size: number, font: Font, color: Colour) =>
    text(s, xRight - measure(s, size, font), y, size, font, color);
  const textCentre = (s: string, xCentre: number, y: number, size: number, font: Font, color: Colour) =>
    text(s, xCentre - measure(s, size, font) / 2, y, size, font, color);
  const hLine = (x1: number, x2: number, y: number, thickness: number, color: Colour) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  const vLine = (x: number, y1: number, y2: number, thickness: number, color: Colour) =>
    page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness, color });
  const fillBox = (x: number, yBottom: number, w: number, h: number, color: Colour) =>
    page.drawRectangle({ x, y: yBottom, width: w, height: h, color });
  const edgeBox = (x: number, yBottom: number, w: number, h: number, color: Colour = STRONG, thickness = EDGE) =>
    page.drawRectangle({ x, y: yBottom, width: w, height: h, borderColor: color, borderWidth: thickness });
  const money = (n: number) => `$${n.toFixed(2)}`;
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' });

  // ============ 1. TOP BAND + HEADER ============
  fillBox(M, H - 48, CW, 8, brass);

  // The studio's wordmark; the name as text only if the logo file is missing
  const logo = loadLogo();
  if (logo) {
    const logoImage = await pdfDoc.embedPng(logo);
    const LOGO_H = 42;
    page.drawImage(logoImage, { x: M, y: H - 98, width: (logoImage.width / logoImage.height) * LOGO_H, height: LOGO_H });
  } else {
    const studioName = fitSize(cfg.companyName.toUpperCase(), 20, fontBold, CW - 230, 11);
    text(studioName.text, M, H - 82, studioName.size, fontBold, ink);
  }
  text('PHOTOGRAPHY  \u00B7  VIDEOGRAPHY  \u00B7  PHOTOBOOTH', M, H - 110, 7.5, fontRegular, faint);

  // Company block, right-aligned. The GST registration number appears once one is set in Settings.
  const ADDR_MAX_LINES = 3;
  const addrWrapped = cfg.address ? wrap(cfg.address, 8.5, fontRegular, 210) : [];
  const addrLines = addrWrapped.slice(0, ADDR_MAX_LINES);
  if (addrWrapped.length > ADDR_MAX_LINES) {
    addrLines[ADDR_MAX_LINES - 1] = fit(`${addrLines[ADDR_MAX_LINES - 1]} ${addrWrapped.slice(ADDR_MAX_LINES).join(' ')}`, 8.5, fontRegular, 210);
  }
  const companyLines = [
    ...(cfg.gstRegNo ? [`GST Reg No: ${cfg.gstRegNo}`] : []),
    ...(cfg.email ? [cfg.email] : []),
    ...(cfg.website ? [cfg.website] : []),
    // The business address from Settings; plain 'Singapore' until one is set
    ...(cfg.address ? addrLines : ['Singapore']),
  ];
  companyLines.forEach((line, i) => textRight(line, RIGHT, H - 72 - i * 11, 8.5, fontRegular, slate));

  // ============ 2. TITLE ROW ============
  // A document that charges GST is a Tax Invoice
  text(isQuote ? 'Quotation' : data.isGstApplied ? 'Tax Invoice' : 'Invoice', M, H - 140, 24, fontBold, ink);
  text(`Issued on ${fmtDate(data.issueDate)}`, M, H - 154, 8.5, fontRegular, slate);

  textRight(`${isQuote ? 'Quotation' : 'Invoice'} #${data.invoiceNumber}`, RIGHT, H - 134, 12, fontBold, ink);
  const statusColor = isQuote
    ? data.status === 'ACCEPTED' ? green : data.status === 'DECLINED' ? faint : STRONG
    : data.status === 'PAID' ? green : data.status === 'PARTIAL' ? brass : STRONG;
  const statusLabel = isQuote
    ? data.status === 'ACCEPTED' || data.status === 'DECLINED' ? `${data.status}` : null
    : data.status === 'PAID' || data.status === 'PARTIAL' || data.status === 'VOID'
      ? `${data.status}`
      : null;
  if (statusLabel) {
    const badgeW = measure(statusLabel, 8, fontBold) + 18;
    fillBox(RIGHT - badgeW, H - 160, badgeW, 16, statusColor);
    textRight(statusLabel, RIGHT - 9, H - 155, 8, fontBold, white);
  }

  hLine(M, RIGHT, H - 174, RULE, SOFT);

  // ============ 3. INFORMATION STRIP ============
  const stripTop = H - 188;
  const c1 = 190; // column widths: Invoice To | Project | Dates
  const c2 = 195;
  // The client's name and contact details always appear in full: shrunk to fit one line where
  // possible, and wrapped onto extra lines (rather than cut short with "...") for anything too long
  // even for that. A client's own legal name is exactly the kind of detail an invoice can't get wrong.
  const clientName = fitNameBlock(data.client.companyName, 11, fontBold, c1 - 20, 8, 3);
  const nameExtraLines = clientName.lines.length - 1;
  // Contact details are all optional, so only the ones that exist are drawn
  const contactBlocks = [
    data.client.contactName?.trim() ? `Attn: ${data.client.contactName.trim()}` : '',
    data.client.email?.trim() ? `Email: ${data.client.email.trim()}` : '',
    data.client.phone?.trim() ? `Phone: ${data.client.phone.trim()}` : '',
  ]
    .filter(Boolean)
    .map((line) => fitNameBlock(line, 9, fontRegular, c1 - 20, 6.5, 3));
  const contactExtraLines = contactBlocks.reduce((sum, b) => sum + (b.lines.length - 1), 0);
  // The client's address (optional) adds up to a few lines under their contact details. Unlike the
  // name/contact fields it isn't shrunk to fit (a slightly longer box reads better than tinier
  // print here), but a rare address too long even for that still gets a visible "..." rather than
  // being silently cut off with no sign anything is missing.
  const ADDRESS_MAX_LINES = 3;
  const addressWrapped = data.client.address ? wrap(data.client.address, 8.5, fontRegular, 190 - 20) : [];
  const clientAddressLines = addressWrapped.slice(0, ADDRESS_MAX_LINES);
  if (addressWrapped.length > ADDRESS_MAX_LINES) {
    clientAddressLines[ADDRESS_MAX_LINES - 1] = fit(
      `${clientAddressLines[ADDRESS_MAX_LINES - 1]} ${addressWrapped.slice(ADDRESS_MAX_LINES).join(' ')}`,
      8.5,
      fontRegular,
      190 - 20
    );
  }
  const stripH = 76 + nameExtraLines * 13 + contactExtraLines * 10 + clientAddressLines.length * 11;
  const x2 = M + c1;
  const x3 = M + c1 + c2;
  // Dividers first, box border last - otherwise the border's corners get lightened where a
  // divider's flat end lands inside the border's own stroke width.
  vLine(x2, stripTop, stripTop - stripH, RULE, SOFT);
  vLine(x3, stripTop, stripTop - stripH, RULE, SOFT);
  edgeBox(M, stripTop - stripH, CW, stripH);

  const label = (s: string, x: number, y: number) => text(s, x, y, 7.5, fontBold, ink);
  label(isQuote ? 'QUOTATION FOR' : 'INVOICE TO', M + 10, stripTop - 15);
  clientName.lines.forEach((l, i) => text(l, M + 10, stripTop - 31 - i * 13, clientName.size, fontBold, ink));
  let contactY = stripTop - 45 - nameExtraLines * 13;
  contactBlocks.forEach((block) => {
    block.lines.forEach((l, i) => text(l, M + 10, contactY - i * 10, block.size, fontRegular, slate));
    contactY -= 12 + (block.lines.length - 1) * 10;
  });
  clientAddressLines.forEach((l, i) => text(l, M + 10, contactY - i * 11, 8.5, fontRegular, slate));

  label('PROJECT / EVENT TITLE', x2 + 10, stripTop - 15);
  const allProjectLines = wrap(data.projectTitle, 11, fontBold, c2 - 20);
  const projectLines = allProjectLines.slice(0, 2);
  if (allProjectLines.length > 2) {
    // keep the second line honest: show that the title continues
    projectLines[1] = fit(`${projectLines[1]} ${allProjectLines.slice(2).join(' ')}`, 11, fontBold, c2 - 20);
  }
  projectLines.forEach((l, i) => text(l, x2 + 10, stripTop - 31 - i * 13, 11, fontBold, ink));
  if (data.client.uen) {
    const uenLine = fitSize(`Client UEN: ${data.client.uen}`, 9, fontRegular, c2 - 20, 6.5);
    text(uenLine.text, x2 + 10, stripTop - 31 - projectLines.length * 13 - 3, uenLine.size, fontRegular, slate);
  }

  label('DATES', x3 + 10, stripTop - 15);
  text('Issued', x3 + 10, stripTop - 30, 7.5, fontRegular, faint);
  text(fmtDate(data.issueDate), x3 + 10, stripTop - 41, 9, fontRegular, ink);
  text(isQuote ? 'Valid until' : 'Due', x3 + 10, stripTop - 55, 7.5, fontRegular, faint);
  text(fmtDate(data.dueDate), x3 + 10, stripTop - 66, 9, fontBold, ink);

  // ============ 4. ITEMS TABLE ============
  const HEADER_H = 22;
  const ROW_MIN = 24;
  const amtX = RIGHT - 100;
  const qtyX = amtX - 50;
  const descW = qtyX - M - 20;
  const cellPad = 8;

  let y = stripTop - stripH - 20;
  let segTop = y;

  const drawTableHeader = () => {
    fillBox(M, y - HEADER_H, CW, HEADER_H, TINT);
    text('DESCRIPTION', M + cellPad, y - 15, 8, fontBold, ink);
    textCentre('QTY', (qtyX + amtX) / 2, y - 15, 8, fontBold, ink);
    textRight('AMOUNT (SGD)', RIGHT - cellPad, y - 15, 8, fontBold, ink);
    y -= HEADER_H;
  };
  // Bold outer edge and soft column dividers around the part of the table drawn on this page
  const closeTableSegment = () => {
    for (const x of [qtyX, amtX]) vLine(x, segTop, y, RULE, SOFT);
    edgeBox(M, y, CW, segTop - y);
    // the heavier line under the heading row
    hLine(M, RIGHT, segTop - HEADER_H, EDGE, STRONG);
  };

  drawTableHeader();

  for (const item of data.items) {
    const lines = item ? wrap(item.description, 9, fontRegular, descW) : [];
    const rowH = Math.max(ROW_MIN, lines.length * 11.5 + 12);
    if (y - rowH < FOOTER_Y + 60) {
      closeTableSegment();
      newPage();
      y = H - 60;
      segTop = y;
      drawTableHeader();
    }
    if (item) {
      lines.forEach((l, i) => text(l, M + cellPad, y - 15 - i * 11.5, 9, fontRegular, ink));
      textCentre(String(item.quantity), (qtyX + amtX) / 2, y - 15, 9, fontRegular, slate);
      if (item.amount === 0) {
        // A no-charge line (e.g. "Culling and editing") reads as included rather than $0.00
        textRight('Included', RIGHT - cellPad, y - 15, 9, fontRegular, slate);
      } else {
        textRight(money(item.amount), RIGHT - cellPad, y - 15, 9, fontBold, ink);
      }
    }
    y -= rowH;
    hLine(M, RIGHT, y, RULE, SOFT);
  }
  closeTableSegment();

  // ============ 5. NOTES + PAYMENT (left) and TOTALS + QR (right) ============
  const discounts = data.discounts ?? [];
  type TotalsRow = { label: string; value: string; kind: 'normal' | 'discount' | 'bold' | 'total' | 'paid' | 'balance' };
  const totalsRows: TotalsRow[] = [{ label: 'Subtotal', value: money(data.subtotal), kind: 'normal' }];
  for (const d of discounts) {
    totalsRows.push({ label: `${discountName(d)} (${discountTerms(d)})`, value: `-${money(d.amount)}`, kind: 'discount' });
  }
  if (discounts.length > 0) {
    totalsRows.push({ label: 'Subtotal after discounts', value: money(data.subtotal - (data.discountAmount ?? 0)), kind: 'bold' });
  }
  if (data.isGstApplied) {
    totalsRows.push({ label: `Singapore GST (${data.gstRate}%)`, value: money(data.gstAmount), kind: 'normal' });
  }
  totalsRows.push({ label: isQuote ? 'QUOTED TOTAL (SGD)' : 'TOTAL AMOUNT', value: money(data.totalAmount), kind: 'total' });
  if (!isQuote) {
    totalsRows.push({ label: 'Paid to Date', value: money(data.paidAmount), kind: 'paid' });
    totalsRows.push({ label: 'BALANCE DUE (SGD)', value: money(data.balanceDue), kind: 'balance' });
  }

  const rowHeight = (k: TotalsRow['kind']) => (k === 'total' ? 24 : k === 'balance' ? 26 : 19);
  const totalsH = totalsRows.reduce((sum, r) => sum + rowHeight(r.kind), 0);
  const TW = 210;
  const TX = RIGHT - TW;
  const rightColH = totalsH;

  // --- PayNow QR (invoices only), drawn inside the payment box right under the Ref line ---
  const QR_SIZE = 90;
  const qrAmount = data.balanceDue > 0 ? data.balanceDue : data.totalAmount;
  // Invoices set to "Static PayNow QR" show the uploaded image instead of a generated code
  const staticQr = data.paymentMethod === 'PAYNOW_STATIC_QR' ? data.company?.staticQrDataUrl ?? null : null;
  let qrImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    if (isQuote) throw new SkipQr();
    const qrDataUrl =
      staticQr ??
      (await generatePayNowQRDataURL({
        uen: cfg.uen,
        amount: qrAmount,
        reference: data.invoiceNumber,
        merchantName: cfg.companyName,
        isEditable: false,
      }));
    const parsed = /^data:image\/(png|jpeg);base64,(.+)$/.exec(qrDataUrl);
    if (!parsed) throw new Error('Unsupported QR image format');
    const qrImageBytes = Buffer.from(parsed[2], 'base64');
    qrImage = parsed[1] === 'jpeg' ? await pdfDoc.embedJpg(qrImageBytes) : await pdfDoc.embedPng(qrImageBytes);
  } catch (err) {
    if (!(err instanceof SkipQr)) console.error('Failed to embed SGQR code in PDF:', err);
  }

  const LW = TX - 20 - M; // left column width, with a clear gutter before the totals
  const noteLines = data.notes && data.notes.trim() ? wrap(data.notes.trim(), 8.5, fontRegular, LW - 20).slice(0, 8) : [];
  const notesH = noteLines.length > 0 ? 26 + noteLines.length * 11 : 0;
  const PAY_H = isQuote ? 96 : 140 + (qrImage ? QR_SIZE + 10 : 0);
  const leftColH = notesH + (notesH ? 12 : 0) + PAY_H;

  // Not enough room left on this page for the whole block: it moves to a fresh page together
  if (y - 18 - Math.max(rightColH, leftColH) < FOOTER_Y + 20) {
    newPage();
    y = H - 60;
  }
  const zoneTop = y - 18;

  // --- Totals grid ---
  let ty = zoneTop;
  for (const r of totalsRows) {
    const h = rowHeight(r.kind);
    if (r.kind === 'total') fillBox(TX, ty - h, TW, h, TINT);
    if (r.kind === 'balance') fillBox(TX, ty - h, TW, h, brassTint);
    const baseline = ty - h / 2 - 3;
    if (r.kind === 'total') {
      text(r.label, TX + 10, baseline, 9.5, fontBold, ink);
      textRight(r.value, RIGHT - 10, baseline, 11, fontBold, ink);
    } else if (r.kind === 'balance') {
      text(r.label, TX + 10, baseline, 9.5, fontBold, ink);
      textRight(r.value, RIGHT - 10, baseline, 11.5, fontBold, ink);
    } else if (r.kind === 'discount') {
      const amountW = measure(r.value, 9, fontRegular);
      text(fit(r.label, 9, fontRegular, TW - 20 - amountW - 8), TX + 10, baseline, 9, fontRegular, slate);
      textRight(r.value, RIGHT - 10, baseline, 9, fontRegular, green);
    } else if (r.kind === 'paid') {
      text(r.label, TX + 10, baseline, 9, fontRegular, green);
      textRight(r.value, RIGHT - 10, baseline, 9, fontBold, green);
    } else if (r.kind === 'bold') {
      text(r.label, TX + 10, baseline, 9, fontBold, slate);
      textRight(r.value, RIGHT - 10, baseline, 9, fontBold, ink);
    } else {
      text(r.label, TX + 10, baseline, 9, fontRegular, slate);
      textRight(r.value, RIGHT - 10, baseline, 9, fontRegular, ink);
    }
    ty -= h;
    // soft divider between rows; a stronger one above the total
    if (r !== totalsRows[totalsRows.length - 1]) {
      const next = totalsRows[totalsRows.indexOf(r) + 1];
      hLine(TX, RIGHT, ty, next.kind === 'total' || next.kind === 'balance' ? EDGE : RULE, next.kind === 'total' || next.kind === 'balance' ? STRONG : SOFT);
    }
  }
  edgeBox(TX, zoneTop - totalsH, TW, totalsH);

  // --- Left column: notes, then payment instructions ---
  let ly = zoneTop;
  if (noteLines.length > 0) {
    edgeBox(M, ly - notesH, LW, notesH, SOFT, 1);
    label('NOTES', M + 10, ly - 15);
    noteLines.forEach((l, i) => text(l, M + 10, ly - 28 - i * 11, 8.5, fontRegular, slate));
    ly -= notesH + 12;
  }

  edgeBox(M, ly - PAY_H, LW, PAY_H);
  fillBox(M, ly - 22, LW, 22, TINT);
  hLine(M, M + LW, ly - 22, RULE, SOFT);
  edgeBox(M, ly - PAY_H, LW, PAY_H);
  text(isQuote ? 'HOW TO ACCEPT' : 'PAYMENT OPTIONS', M + 12, ly - 15, 9.5, fontBold, ink);
  const px = M + 12;
  const pw = LW - 24;
  let py = ly - 38;
  if (isQuote) {
    // A quotation asks for a reply, not a payment
    const acceptLines = [
      `This quotation is valid until ${fmtDate(data.dueDate)}.`,
      'To confirm the booking, reply to this quotation.',
      'We will then issue an invoice for payment.',
      'All prices are in Singapore dollars (SGD).',
    ];
    acceptLines.forEach((l, i) => text(fit(l, 8.5, fontRegular, pw), px, py - i * 13, 8.5, fontRegular, i === 0 ? ink : slate));
  } else {
  text('1. Bank Transfer', px, py, 8.5, fontBold, ink);
  py -= 12;
  text(fit(`Bank: ${cfg.bankName}${cfg.bankBranchCode ? ` (Branch: ${cfg.bankBranchCode})` : ''}`, 8, fontRegular, pw - 10), px + 10, py, 8, fontRegular, slate);
  py -= 11;
  text(fit(`A/C No: ${cfg.bankAccountNumber} (${cfg.bankAccountName})`, 8, fontRegular, pw - 10), px + 10, py, 8, fontRegular, slate);
  py -= 16;
  text('2. PayNow (UEN)', px, py, 8.5, fontBold, ink);
  py -= 12;
  text(fit(`UEN: ${cfg.uen} (${cfg.companyName})`, 8, fontRegular, pw - 10), px + 10, py, 8, fontRegular, slate);
  py -= 16;
  text('3. Scan with any Singapore bank app', px, py, 8.5, fontBold, ink);
  py -= 12;
  text('DBS PayLah!, OCBC, UOB, GrabPay, etc.', px + 10, py, 8, fontRegular, slate);
  py -= 11;
  text(`Ref: ${data.invoiceNumber}`, px + 10, py, 8, fontBold, ink);
  if (qrImage) {
    // The QR sits directly under the Ref line, with its caption beside it
    const qrX = px + 10;
    const qrBottom = py - 10 - QR_SIZE;
    page.drawImage(qrImage, { x: qrX, y: qrBottom, width: QR_SIZE, height: QR_SIZE });
    const capX = qrX + QR_SIZE + 12;
    text(staticQr ? 'PayNow QR' : 'PayNow SGQR', capX, qrBottom + QR_SIZE / 2 + 3, 8, fontBold, ink);
    text(staticQr ? `Enter SGD $${qrAmount.toFixed(2)}` : `Scan SGD $${qrAmount.toFixed(2)}`, capX, qrBottom + QR_SIZE / 2 - 8, 7.5, fontRegular, slate);
  }
  }

  // ============ 6. FOOTER (every page) ============
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: FOOTER_Y + 15 }, end: { x: RIGHT, y: FOOTER_Y + 15 }, thickness: RULE, color: SOFT });
    drawOn(p, `Thank you for partnering with ${cfg.companyName}.`, M, FOOTER_Y, 8, fontOblique, faint);
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: RIGHT - fontRegular.widthOfTextAtSize(label, 8), y: FOOTER_Y, size: 8, font: fontRegular, color: faint });
  });

  return pdfDoc.save();
}