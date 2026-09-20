import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { defaultPaymentConfig } from './payment-config';
import { generatePayNowPayload, generatePayNowQRDataURL } from './sgqr';

export interface InvoicePDFData {
  invoiceNumber: string;
  issueDate: string | Date;
  dueDate: string | Date;
  status: string;
  paymentMethod: string | null;
  subtotal: number;
  isGstApplied: boolean;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  notes?: string | null;
  client: {
    companyName: string;
    contactName: string;
    email: string;
    phone?: string | null;
    uen?: string | null;
  };
  projectTitle: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize(); // 595.28 x 841.89 pt

  // Fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Colors
  const black = rgb(0.1, 0.1, 0.1);
  const darkGray = rgb(0.3, 0.3, 0.3);
  const lightGray = rgb(0.55, 0.55, 0.55);
  const borderGray = rgb(0.85, 0.85, 0.85);
  const accentRed = rgb(0.48, 0.07, 0.08); // Singapore PayNow Burgundy
  const accentGold = rgb(0.85, 0.65, 0.13);

  let y = height - 50;

  // --- 1. HEADER (Studio Info) ---
  page.drawText(defaultPaymentConfig.companyName.toUpperCase(), {
    x: 50,
    y,
    size: 20,
    font: fontBold,
    color: black,
  });

  page.drawText('INVOICE', {
    x: width - 150,
    y,
    size: 22,
    font: fontBold,
    color: accentRed,
  });

  y -= 18;
  page.drawText(`UEN: ${defaultPaymentConfig.uen} • Singapore`, {
    x: 50,
    y,
    size: 9,
    font: fontRegular,
    color: darkGray,
  });

  page.drawText(`# ${data.invoiceNumber}`, {
    x: width - 150,
    y,
    size: 11,
    font: fontBold,
    color: black,
  });

  y -= 14;
  page.drawText('contact@jsquarephotography.com', {
    x: 50,
    y,
    size: 9,
    font: fontRegular,
    color: lightGray,
  });

  const issueDateStr = new Date(data.issueDate).toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  page.drawText(`Date: ${issueDateStr}`, {
    x: width - 150,
    y,
    size: 9,
    font: fontRegular,
    color: darkGray,
  });

  y -= 14;
  const dueDateStr = new Date(data.dueDate).toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  page.drawText(`Due Date: ${dueDateStr}`, {
    x: width - 150,
    y,
    size: 9,
    font: fontBold,
    color: data.status === 'PAID' ? darkGray : accentRed,
  });

  // Top Divider Line
  y -= 20;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: borderGray,
  });

  // --- 2. BILL TO & PROJECT ---
  y -= 25;
  page.drawText('INVOICE TO:', {
    x: 50,
    y,
    size: 9,
    font: fontBold,
    color: lightGray,
  });

  page.drawText('PROJECT / ASSIGNMENT:', {
    x: 320,
    y,
    size: 9,
    font: fontBold,
    color: lightGray,
  });

  y -= 16;
  page.drawText(data.client.companyName, {
    x: 50,
    y,
    size: 11,
    font: fontBold,
    color: black,
  });

  page.drawText(data.projectTitle, {
    x: 320,
    y,
    size: 11,
    font: fontBold,
    color: black,
  });

  y -= 14;
  page.drawText(`Attn: ${data.client.contactName}`, {
    x: 50,
    y,
    size: 9,
    font: fontRegular,
    color: darkGray,
  });

  if (data.client.uen) {
    page.drawText(`Client UEN: ${data.client.uen}`, {
      x: 320,
      y,
      size: 9,
      font: fontRegular,
      color: darkGray,
    });
  }

  y -= 14;
  page.drawText(`Email: ${data.client.email}`, {
    x: 50,
    y,
    size: 9,
    font: fontRegular,
    color: darkGray,
  });

  // Status Badge banner
  const statusColor = data.status === 'PAID' ? rgb(0.1, 0.6, 0.2) : data.status === 'PARTIAL' ? accentGold : accentRed;
  page.drawRectangle({
    x: width - 145,
    y: y - 2,
    width: 95,
    height: 18,
    color: statusColor,
  });
  page.drawText(`STATUS: ${data.status}`, {
    x: width - 140,
    y: y + 3,
    size: 8,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // --- 3. ITEMS TABLE ---
  y -= 35;
  const tableTop = y;
  const colX = {
    desc: 50,
    qty: 360,
    unitPrice: 420,
    amount: 500,
  };

  // Table Header Background
  page.drawRectangle({
    x: 50,
    y: y - 5,
    width: width - 100,
    height: 22,
    color: rgb(0.96, 0.96, 0.96),
  });

  page.drawText('DESCRIPTION', { x: colX.desc + 5, y, size: 9, font: fontBold, color: black });
  page.drawText('QTY', { x: colX.qty, y, size: 9, font: fontBold, color: black });
  page.drawText('UNIT (SGD)', { x: colX.unitPrice, y, size: 9, font: fontBold, color: black });
  page.drawText('TOTAL (SGD)', { x: colX.amount, y, size: 9, font: fontBold, color: black });

  y -= 10;

  // Table Rows
  for (const item of data.items) {
    y -= 18;
    page.drawLine({
      start: { x: 50, y: y + 14 },
      end: { x: width - 50, y: y + 14 },
      thickness: 0.5,
      color: borderGray,
    });

    const desc = item.description.length > 45 ? `${item.description.substring(0, 42)}...` : item.description;
    page.drawText(desc, { x: colX.desc + 5, y, size: 9, font: fontRegular, color: black });
    page.drawText(item.quantity.toString(), { x: colX.qty + 5, y, size: 9, font: fontRegular, color: darkGray });
    page.drawText(`$${item.unitPrice.toFixed(2)}`, { x: colX.unitPrice, y, size: 9, font: fontRegular, color: darkGray });
    page.drawText(`$${item.amount.toFixed(2)}`, { x: colX.amount, y, size: 9, font: fontBold, color: black });
  }

  y -= 15;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: borderGray,
  });

  // --- 4. TOTALS SECTION ---
  y -= 20;
  const totalsX = 380;
  const valuesX = 500;

  page.drawText('Subtotal:', { x: totalsX, y, size: 9, font: fontRegular, color: darkGray });
  page.drawText(`$${data.subtotal.toFixed(2)}`, { x: valuesX, y, size: 9, font: fontRegular, color: black });

  if (data.isGstApplied) {
    y -= 16;
    page.drawText(`Singapore GST (${data.gstRate}%):`, { x: totalsX, y, size: 9, font: fontRegular, color: darkGray });
    page.drawText(`$${data.gstAmount.toFixed(2)}`, { x: valuesX, y, size: 9, font: fontRegular, color: black });
  }

  y -= 18;
  page.drawRectangle({
    x: totalsX - 10,
    y: y - 5,
    width: width - totalsX - 40,
    height: 24,
    color: rgb(0.96, 0.96, 0.96),
  });
  page.drawText('Total Amount:', { x: totalsX, y, size: 10, font: fontBold, color: black });
  page.drawText(`$${data.totalAmount.toFixed(2)}`, { x: valuesX, y, size: 11, font: fontBold, color: black });

  y -= 18;
  page.drawText('Paid to Date:', { x: totalsX, y, size: 9, font: fontRegular, color: rgb(0.1, 0.6, 0.2) });
  page.drawText(`$${data.paidAmount.toFixed(2)}`, { x: valuesX, y, size: 9, font: fontBold, color: rgb(0.1, 0.6, 0.2) });

  y -= 18;
  page.drawText('Balance Due (SGD):', { x: totalsX, y, size: 10, font: fontBold, color: accentRed });
  page.drawText(`$${data.balanceDue.toFixed(2)}`, { x: valuesX, y, size: 11, font: fontBold, color: accentRed });

  // --- 5. PAYMENT INSTRUCTIONS (With Dynamic SGQR Image) ---
  const paymentBoxY = y - 10;
  const paymentBoxHeight = 150;
  const paymentBoxWidth = 310;

  page.drawRectangle({
    x: 50,
    y: paymentBoxY - paymentBoxHeight + 15,
    width: paymentBoxWidth,
    height: paymentBoxHeight,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: borderGray,
    borderWidth: 1,
  });

  let payY = paymentBoxY;
  page.drawText('PAYMENT INSTRUCTIONS', {
    x: 65,
    y: payY,
    size: 10,
    font: fontBold,
    color: accentRed,
  });

  payY -= 16;
  page.drawText('1. Bank Transfer:', { x: 65, y: payY, size: 8.5, font: fontBold, color: black });
  payY -= 12;
  page.drawText(`   Bank: ${defaultPaymentConfig.bankName} (Branch: ${defaultPaymentConfig.bankBranchCode})`, { x: 65, y: payY, size: 8, font: fontRegular, color: darkGray });
  payY -= 12;
  page.drawText(`   A/C No: ${defaultPaymentConfig.bankAccountNumber} (${defaultPaymentConfig.bankAccountName})`, { x: 65, y: payY, size: 8, font: fontRegular, color: darkGray });

  payY -= 16;
  page.drawText('2. PayNow (UEN):', { x: 65, y: payY, size: 8.5, font: fontBold, color: black });
  payY -= 12;
  page.drawText(`   UEN: ${defaultPaymentConfig.uen} (${defaultPaymentConfig.companyName})`, { x: 65, y: payY, size: 8, font: fontRegular, color: darkGray });

  payY -= 16;
  page.drawText('3. Scan with Any Singapore Bank App:', { x: 65, y: payY, size: 8.5, font: fontBold, color: black });
  payY -= 12;
  page.drawText('   DBS PayLah!, OCBC, UOB, GrabPay', { x: 65, y: payY, size: 8, font: fontRegular, color: darkGray });
  payY -= 12;
  page.drawText(`   Ref: ${data.invoiceNumber}`, { x: 65, y: payY, size: 8, font: fontBold, color: accentRed });

  // Generate and embed Dynamic PayNow SGQR Code directly into the PDF
  try {
    const qrAmount = data.balanceDue > 0 ? data.balanceDue : data.totalAmount;
    const qrDataUrl = await generatePayNowQRDataURL({
      uen: defaultPaymentConfig.uen,
      amount: qrAmount,
      reference: data.invoiceNumber,
      merchantName: defaultPaymentConfig.companyName,
      isEditable: false,
    });

    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const qrImageBytes = Buffer.from(base64Data, 'base64');
    const qrImage = await pdfDoc.embedPng(qrImageBytes);

    const qrSize = 120;
    const qrX = 370;
    const qrY = paymentBoxY - paymentBoxHeight + 35;

    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    });

    page.drawText('PayNow SGQR', {
      x: qrX + 22,
      y: qrY - 12,
      size: 8,
      font: fontBold,
      color: accentRed,
    });
    page.drawText(`Scan SGD $${qrAmount.toFixed(2)}`, {
      x: qrX + 16,
      y: qrY - 22,
      size: 7.5,
      font: fontRegular,
      color: darkGray,
    });
  } catch (err) {
    console.error('Failed to embed SGQR code in PDF:', err);
  }

  // --- 6. FOOTER ---
  const footerY = 30;
  page.drawLine({
    start: { x: 50, y: footerY + 15 },
    end: { x: width - 50, y: footerY + 15 },
    thickness: 0.5,
    color: borderGray,
  });

  page.drawText('Thank you for partnering with J Square Photography. All rights reserved.', {
    x: 50,
    y: footerY,
    size: 8,
    font: fontOblique,
    color: lightGray,
  });

  return pdfDoc.save();
}
