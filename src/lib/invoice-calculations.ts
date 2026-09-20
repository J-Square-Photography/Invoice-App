export interface RawInvoiceItemInput {
  description?: string;
  quantity?: number | string;
  unitPrice?: number | string;
}

export interface ProcessedInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceTotals {
  items: ProcessedInvoiceItem[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
}

/** Rounds to 2 decimal places, avoiding common floating point drift. */
export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function processInvoiceItem(item: RawInvoiceItemInput): ProcessedInvoiceItem {
  const quantity = Math.max(1, parseInt(item.quantity?.toString() || '1', 10));
  const unitPrice = Math.max(0, parseFloat(item.unitPrice?.toString() || '0'));
  const amount = roundCents(quantity * unitPrice);
  return {
    description: item.description?.trim() || 'Service Item',
    quantity,
    unitPrice,
    amount,
  };
}

export function calculateInvoiceTotals(
  rawItems: RawInvoiceItemInput[],
  options: { isGstApplied: boolean; gstRate: number }
): InvoiceTotals {
  const items = rawItems.map(processInvoiceItem);
  const subtotal = roundCents(items.reduce((sum, item) => sum + item.amount, 0));

  const gstRate = options.isGstApplied ? options.gstRate : 0;
  const gstAmount = options.isGstApplied ? roundCents(subtotal * (gstRate / 100)) : 0;
  const totalAmount = roundCents(subtotal + gstAmount);

  return { items, subtotal, gstRate, gstAmount, totalAmount };
}
