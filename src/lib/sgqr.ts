import QRCode from 'qrcode';

/**
 * Format an EMVCo Tag-Length-Value (TLV) field
 * [Tag 2 digits][Length 2 digits][Value]
 */
export function formatTLV(tag: string, value: string): string {
  const paddedTag = tag.padStart(2, '0');
  const length = value.length.toString().padStart(2, '0');
  return `${paddedTag}${length}${value}`;
}

/**
 * Compute CRC-16/CCITT checksum as required by the EMVCo Merchant-Presented QR standard.
 * Polynomial: 0x1021, Initial value: 0xFFFF
 */
export function computeCRC16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    crc ^= (code << 8) & 0xffff;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PayNowQROptions {
  uen: string;
  amount?: number;
  reference?: string;
  merchantName?: string;
  isEditable?: boolean;
  expiryDate?: string; // YYYYMMDD
}

/**
 * Generates an EMVCo-compliant Singapore PayNow QR payload string.
 * This payload is compatible with SGQR and recognized by all Singapore banking apps
 * (DBS PayLah!, OCBC, UOB, Standard Chartered, GrabPay, etc.)
 */
export function generatePayNowPayload(options: PayNowQROptions): string {
  const {
    uen,
    amount,
    reference,
    merchantName = 'J SQUARE PHOTOGRAPHY',
    isEditable = amount === undefined || amount <= 0,
    expiryDate,
  } = options;

  // Tag 00: Payload Format Indicator (01)
  const tag00 = formatTLV('00', '01');

  // Tag 01: Point of Initiation Method
  // 12 = Dynamic (amount specified & single use/transaction)
  // 11 = Static (generic or editable)
  const isDynamic = amount !== undefined && amount > 0 && !isEditable;
  const tag01 = formatTLV('01', isDynamic ? '12' : '11');

  // Tag 26: PayNow Merchant Account Information (SG.PAYNOW)
  // Subtag 00: Globally Unique Identifier
  const sub00 = formatTLV('00', 'SG.PAYNOW');
  // Subtag 01: Proxy Type (2 = UEN, 0 = Mobile, 1 = NRIC)
  const sub01 = formatTLV('01', '2');
  // Subtag 02: Proxy Value (Company UEN)
  const cleanUen = uen.trim().toUpperCase();
  const sub02 = formatTLV('02', cleanUen);
  // Subtag 03: Amount Editable (0 = Not editable, 1 = Editable)
  const sub03 = formatTLV('03', isEditable ? '1' : '0');
  // Subtag 04: Expiry date (optional YYYYMMDD)
  const sub04 = expiryDate ? formatTLV('04', expiryDate) : '';

  const tag26Value = `${sub00}${sub01}${sub02}${sub03}${sub04}`;
  const tag26 = formatTLV('26', tag26Value);

  // Tag 52: Merchant Category Code (0000 default)
  const tag52 = formatTLV('52', '0000');

  // Tag 53: Transaction Currency (702 = SGD)
  const tag53 = formatTLV('53', '702');

  // Tag 54: Transaction Amount (if specified and positive)
  let tag54 = '';
  if (amount !== undefined && amount > 0) {
    const formattedAmount = amount.toFixed(2);
    tag54 = formatTLV('54', formattedAmount);
  }

  // Tag 58: Country Code (SG)
  const tag58 = formatTLV('58', 'SG');

  // Tag 59: Merchant Name
  const cleanName = merchantName.trim().toUpperCase().substring(0, 25);
  const tag59 = formatTLV('59', cleanName);

  // Tag 60: Merchant City
  const tag60 = formatTLV('60', 'SINGAPORE');

  // Tag 62: Additional Data Field Template (Bill/Invoice Reference)
  let tag62 = '';
  if (reference) {
    const cleanRef = reference.trim().substring(0, 25);
    const sub62_01 = formatTLV('01', cleanRef);
    tag62 = formatTLV('62', sub62_01);
  }

  // Combine tags up to Tag 63 (CRC ID + Length = "6304")
  const partialPayload = `${tag00}${tag01}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`;

  // Compute CRC16 over the entire partial payload
  const checksum = computeCRC16(partialPayload);

  return `${partialPayload}${checksum}`;
}

/**
 * Generates a PNG Data URL representing the PayNow SGQR code
 */
export async function generatePayNowQRDataURL(
  options: PayNowQROptions,
  qrOptions?: QRCode.QRCodeToDataURLOptions
): Promise<string> {
  const payload = generatePayNowPayload(options);
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#7B1113', // Singapore PayNow signature burgundy or dark neutral
      light: '#FFFFFF',
    },
    ...qrOptions,
  });
}

/**
 * Generates an SVG string representing the PayNow SGQR code
 */
export async function generatePayNowQRSVG(
  options: PayNowQROptions,
  qrOptions?: QRCode.QRCodeToStringOptions
): Promise<string> {
  const payload = generatePayNowPayload(options);
  return QRCode.toString(payload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    ...qrOptions,
  });
}
