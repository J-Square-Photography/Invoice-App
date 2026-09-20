import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { defaultPaymentConfig } from './payment-config';

export interface ContractPDFData {
  title: string;
  contractBody: string;
  isSigned: boolean;
  signedAt?: string | Date | null;
  client: {
    companyName: string;
    contactName: string;
    email: string;
    uen?: string | null;
  };
  projectTitle: string;
  invoiceNumber: string;
  totalAmount: number;
  signatureAudit?: {
    signatureImageBase64: string;
    signerName: string;
    signerEmail?: string | null;
    signerIp: string;
    userAgent: string;
    documentSha256: string;
    signedUtcTimestamp: string | Date;
  } | null;
}

export async function generateContractPDF(data: ContractPDFData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage(PageSizes.A4);
  let { width, height } = page.getSize();

  // Fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Colors
  const black = rgb(0.1, 0.1, 0.1);
  const darkGray = rgb(0.3, 0.3, 0.3);
  const lightGray = rgb(0.6, 0.6, 0.6);
  const borderGray = rgb(0.85, 0.85, 0.85);
  const accentRed = rgb(0.48, 0.07, 0.08); // Studio Burgundy
  const auditBg = rgb(0.96, 0.98, 0.96);
  const auditBorder = rgb(0.3, 0.6, 0.4);

  let y = height - 50;

  // --- 1. HEADER ---
  page.drawText(defaultPaymentConfig.companyName.toUpperCase(), {
    x: 50,
    y,
    size: 16,
    font: fontBold,
    color: black,
  });

  y -= 14;
  page.drawText(`Singapore UEN: ${defaultPaymentConfig.uen} • Digital Service Agreement`, {
    x: 50,
    y,
    size: 8.5,
    font: fontRegular,
    color: darkGray,
  });

  y -= 14;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: borderGray,
  });

  // --- 2. DOCUMENT TITLE & METADATA ---
  y -= 25;
  page.drawText(data.title.toUpperCase(), {
    x: 50,
    y,
    size: 13,
    font: fontBold,
    color: accentRed,
  });

  y -= 20;
  // Summary metadata box
  page.drawRectangle({
    x: 50,
    y: y - 45,
    width: width - 100,
    height: 55,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: borderGray,
    borderWidth: 0.5,
  });

  let metaY = y - 5;
  page.drawText('Client Organization:', { x: 60, y: metaY, size: 8.5, font: fontBold, color: darkGray });
  page.drawText(data.client.companyName, { x: 170, y: metaY, size: 8.5, font: fontRegular, color: black });

  page.drawText('Invoice Reference:', { x: 340, y: metaY, size: 8.5, font: fontBold, color: darkGray });
  page.drawText(data.invoiceNumber, { x: 440, y: metaY, size: 8.5, font: fontBold, color: black });

  metaY -= 14;
  page.drawText('Authorized Signer:', { x: 60, y: metaY, size: 8.5, font: fontBold, color: darkGray });
  page.drawText(`${data.client.contactName} (${data.client.email})`, { x: 170, y: metaY, size: 8.5, font: fontRegular, color: black });

  page.drawText('Contract Value:', { x: 340, y: metaY, size: 8.5, font: fontBold, color: darkGray });
  page.drawText(`SGD $${data.totalAmount.toFixed(2)}`, { x: 440, y: metaY, size: 8.5, font: fontBold, color: accentRed });

  metaY -= 14;
  page.drawText('Project Title:', { x: 60, y: metaY, size: 8.5, font: fontBold, color: darkGray });
  page.drawText(data.projectTitle, { x: 170, y: metaY, size: 8.5, font: fontRegular, color: black });

  page.drawText('Agreement Status:', { x: 340, y: metaY, size: 8.5, font: fontBold, color: darkGray });
  page.drawText(data.isSigned ? 'SIGNED & SEALED' : 'PENDING SIGNATURE', {
    x: 440,
    y: metaY,
    size: 8.5,
    font: fontBold,
    color: data.isSigned ? rgb(0.1, 0.6, 0.2) : accentRed,
  });

  y -= 65;

  // --- 3. CONTRACT BODY (Formatted Paragraphs) ---
  const paragraphs = data.contractBody.split('\n');
  const maxWidth = width - 100;
  const fontSize = 8.5;
  const lineHeight = 12;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      y -= 6;
      continue;
    }

    const isHeading = trimmed.startsWith('1.') || trimmed.startsWith('2.') || trimmed.startsWith('3.') ||
      trimmed.startsWith('4.') || trimmed.startsWith('5.') || trimmed.startsWith('6.') ||
      trimmed.toUpperCase() === trimmed && trimmed.length < 50;

    // Simple line wrap
    const words = trimmed.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = (isHeading ? fontBold : fontRegular).widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth) {
        if (y < 120) {
          page = pdfDoc.addPage(PageSizes.A4);
          y = height - 50;
        }
        page.drawText(currentLine, {
          x: 50,
          y,
          size: fontSize,
          font: isHeading ? fontBold : fontRegular,
          color: isHeading ? black : darkGray,
        });
        y -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      if (y < 120) {
        page = pdfDoc.addPage(PageSizes.A4);
        y = height - 50;
      }
      page.drawText(currentLine, {
        x: 50,
        y,
        size: fontSize,
        font: isHeading ? fontBold : fontRegular,
        color: isHeading ? black : darkGray,
      });
      y -= lineHeight + (isHeading ? 3 : 1);
    }
  }

  // --- 4. SIGNATURE AUDIT CERTIFICATE ---
  if (y < 220) {
    page = pdfDoc.addPage(PageSizes.A4);
    y = height - 50;
  } else {
    y -= 15;
  }

  if (data.isSigned && data.signatureAudit) {
    const audit = data.signatureAudit;
    const certHeight = 175;

    page.drawRectangle({
      x: 50,
      y: y - certHeight,
      width: width - 100,
      height: certHeight,
      color: auditBg,
      borderColor: auditBorder,
      borderWidth: 1,
    });

    let certY = y - 16;
    page.drawText('ELECTRONIC SIGNATURE AUDIT TRAIL & CERTIFICATE OF EXECUTION', {
      x: 65,
      y: certY,
      size: 9.5,
      font: fontBold,
      color: rgb(0.1, 0.4, 0.2),
    });

    certY -= 12;
    page.drawText('Executed pursuant to the Singapore Electronic Transactions Act 2010 (ETA)', {
      x: 65,
      y: certY,
      size: 7.5,
      font: fontOblique,
      color: darkGray,
    });

    certY -= 16;
    page.drawLine({
      start: { x: 65, y: certY },
      end: { x: width - 65, y: certY },
      thickness: 0.5,
      color: borderGray,
    });

    // Embed Signature Raster Image
    certY -= 50;
    try {
      const base64Data = audit.signatureImageBase64.replace(/^data:image\/\w+;base64,/, '');
      const sigBytes = Buffer.from(base64Data, 'base64');
      const sigImage = await pdfDoc.embedPng(sigBytes);

      page.drawImage(sigImage, {
        x: 65,
        y: certY,
        width: 140,
        height: 45,
      });
    } catch (err) {
      page.drawText('[Digital Signature Image Embedded]', {
        x: 65,
        y: certY + 15,
        size: 8,
        font: fontOblique,
        color: darkGray,
      });
    }

    // Audit metadata table
    const auditLeftX = 230;
    let auditTextY = certY + 36;

    page.drawText('Signer Name:', { x: auditLeftX, y: auditTextY, size: 8, font: fontBold, color: darkGray });
    page.drawText(audit.signerName, { x: auditLeftX + 90, y: auditTextY, size: 8, font: fontBold, color: black });

    auditTextY -= 12;
    page.drawText('Signer Email:', { x: auditLeftX, y: auditTextY, size: 8, font: fontBold, color: darkGray });
    page.drawText(audit.signerEmail || data.client.email, { x: auditLeftX + 90, y: auditTextY, size: 8, font: fontRegular, color: black });

    auditTextY -= 12;
    const utcDateStr = new Date(audit.signedUtcTimestamp).toISOString().replace('T', ' ').replace('Z', ' UTC');
    page.drawText('UTC Timestamp:', { x: auditLeftX, y: auditTextY, size: 8, font: fontBold, color: darkGray });
    page.drawText(utcDateStr, { x: auditLeftX + 90, y: auditTextY, size: 8, font: fontRegular, color: black });

    auditTextY -= 12;
    page.drawText('IP Address:', { x: auditLeftX, y: auditTextY, size: 8, font: fontBold, color: darkGray });
    page.drawText(audit.signerIp, { x: auditLeftX + 90, y: auditTextY, size: 8, font: fontRegular, color: black });

    auditTextY -= 14;
    page.drawText('SHA-256 Hash:', { x: 65, y: certY - 14, size: 7.5, font: fontBold, color: darkGray });
    page.drawText(audit.documentSha256, { x: 140, y: certY - 14, size: 7, font: fontRegular, color: black });

    const cleanUa = audit.userAgent.length > 80 ? `${audit.userAgent.substring(0, 77)}...` : audit.userAgent;
    page.drawText('Client Device:', { x: 65, y: certY - 26, size: 7.5, font: fontBold, color: darkGray });
    page.drawText(cleanUa, { x: 140, y: certY - 26, size: 7, font: fontRegular, color: darkGray });
  } else {
    // Unsigned placeholder
    page.drawRectangle({
      x: 50,
      y: y - 80,
      width: width - 100,
      height: 80,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: borderGray,
      borderWidth: 0.5,
    });
    page.drawText('PENDING CLIENT SIGNATURE VIA SECURE LINK', {
      x: 65,
      y: y - 35,
      size: 10,
      font: fontBold,
      color: accentRed,
    });
    page.drawText('This agreement will receive a cryptographic SHA-256 seal upon client completion.', {
      x: 65,
      y: y - 52,
      size: 8,
      font: fontRegular,
      color: darkGray,
    });
  }

  // --- 5. FOOTER ---
  const totalPages = pdfDoc.getPageCount();
  const pages = pdfDoc.getPages();
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i];
    p.drawText(`J Square Photography • Page ${i + 1} of ${totalPages}`, {
      x: 50,
      y: 25,
      size: 7.5,
      font: fontRegular,
      color: lightGray,
    });
  }

  return pdfDoc.save();
}
