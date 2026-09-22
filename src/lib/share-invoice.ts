/** Ready-to-send messages for an invoice, for WhatsApp or email. The PDF itself is attached by hand. */
export interface ShareInvoiceInput {
  companyName: string;
  clientName: string;
  contactName?: string | null;
  invoiceNumber: string;
  projectTitle: string;
  balanceDue: number;
  totalAmount: number;
  dueDate: string | Date;
  payNowUen?: string | null;
  isTaxInvoice?: boolean;
}

const money = (n: number) => `SGD $${n.toFixed(2)}`;

export function invoiceSubject(i: ShareInvoiceInput): string {
  return `${i.isTaxInvoice ? 'Tax Invoice' : 'Invoice'} ${i.invoiceNumber} from ${i.companyName}`;
}

export function invoiceMessage(i: ShareInvoiceInput): string {
  const greeting = i.contactName?.trim() ? `Hi ${i.contactName.trim()},` : `Hi ${i.clientName},`;
  const due = new Date(i.dueDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
  const owing = i.balanceDue > 0 && i.balanceDue < i.totalAmount ? `Balance due: ${money(i.balanceDue)} (invoice total ${money(i.totalAmount)})` : `Amount due: ${money(i.balanceDue > 0 ? i.balanceDue : i.totalAmount)}`;
  return [
    greeting,
    '',
    `Please find ${i.isTaxInvoice ? 'tax invoice' : 'invoice'} ${i.invoiceNumber} for ${i.projectTitle} attached.`,
    owing,
    `Due date: ${due}`,
    ...(i.payNowUen ? ['', `You can pay by PayNow to UEN ${i.payNowUen}, or by scanning the QR code on the invoice.`] : []),
    '',
    'Thank you!',
    i.companyName,
  ].join('\n');
}

/** Digits only, in the international form wa.me expects. Local 8-digit Singapore numbers get +65. */
export function whatsappNumber(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 8) return `65${digits}`;
  return digits;
}

export function whatsappUrl(phone: string | null | undefined, message: string): string {
  return `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`;
}

export function mailtoUrl(email: string | null | undefined, subject: string, body: string): string {
  return `mailto:${email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export interface ShareQuoteInput {
  companyName: string;
  clientName: string;
  contactName?: string | null;
  quoteNumber: string;
  projectTitle: string;
  totalAmount: number;
  validUntil: string | Date;
}

export function quoteSubject(q: ShareQuoteInput): string {
  return `Quotation ${q.quoteNumber} from ${q.companyName}`;
}

export function quoteMessage(q: ShareQuoteInput): string {
  const greeting = q.contactName?.trim() ? `Hi ${q.contactName.trim()},` : `Hi ${q.clientName},`;
  const valid = new Date(q.validUntil).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
  return [
    greeting,
    '',
    `Please find quotation ${q.quoteNumber} for ${q.projectTitle} attached.`,
    `Quoted total: ${money(q.totalAmount)}`,
    `Valid until: ${valid}`,
    '',
    "Let us know if you'd like to go ahead and we'll confirm the booking and send the invoice.",
    '',
    'Thank you!',
    q.companyName,
  ].join('\n');
}
