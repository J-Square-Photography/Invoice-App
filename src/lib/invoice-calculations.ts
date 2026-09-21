export interface RawInvoiceItemInput {
  description?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  /**
   * The line total. When given it is the source of truth (this is what the invoice
   * form sends) and the unit price is derived from it; otherwise the total is
   * quantity x unitPrice.
   */
  amount?: number | string;
}

export interface ProcessedInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export type DiscountType = 'PERCENT' | 'FLAT';

export interface RawDiscountInput {
  name?: string;
  type?: string;
  /** A percentage (0 to 100) when type is PERCENT, otherwise a dollar amount. */
  value?: number | string;
}

/** One discount as applied, with the running price before and after it. */
export interface ProcessedDiscount {
  name: string;
  type: DiscountType;
  value: number;
  /** Dollars taken off by this discount. */
  amount: number;
  priceBefore: number;
  priceAfter: number;
}

export const MAX_DISCOUNTS = 10;

export interface InvoiceTotals {
  items: ProcessedInvoiceItem[];
  /** Sum of the line items, before any discount. */
  subtotal: number;
  discounts: ProcessedDiscount[];
  /** Total dollars taken off by all discounts. */
  discountAmount: number;
  /** subtotal minus discounts: the amount GST is charged on. */
  taxableAmount: number;
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

  if (item.amount !== undefined && item.amount !== null && item.amount !== '') {
    const amount = roundCents(Math.max(0, parseFloat(item.amount.toString()) || 0));
    return {
      description: item.description?.trim() || 'Service Item',
      quantity,
      unitPrice: roundCents(amount / quantity),
      amount,
    };
  }

  const unitPrice = Math.max(0, parseFloat(item.unitPrice?.toString() || '0'));
  const amount = roundCents(quantity * unitPrice);
  return {
    description: item.description?.trim() || 'Service Item',
    quantity,
    unitPrice,
    amount,
  };
}

/**
 * Applies discounts one after another, in the order given: each percentage is taken
 * from what is left after the discounts above it, and a flat amount is subtracted
 * as dollars. A discount can never take the price below zero. Discounts with no value
 * are ignored.
 */
export function processDiscounts(subtotal: number, raw: RawDiscountInput[] = []): ProcessedDiscount[] {
  const out: ProcessedDiscount[] = [];
  let running = roundCents(subtotal);

  for (const d of raw.slice(0, MAX_DISCOUNTS)) {
    const type: DiscountType = d.type === 'FLAT' ? 'FLAT' : 'PERCENT';
    let value = Math.max(0, parseFloat(d.value?.toString() || '0') || 0);
    if (type === 'PERCENT') value = Math.min(100, value);
    if (value <= 0) continue;

    let amount = type === 'PERCENT' ? roundCents((running * value) / 100) : roundCents(value);
    amount = Math.min(amount, running);

    const priceAfter = roundCents(running - amount);
    out.push({
      name: d.name?.trim() || 'Discount',
      type,
      value: type === 'PERCENT' ? value : roundCents(value),
      amount,
      priceBefore: running,
      priceAfter,
    });
    running = priceAfter;
  }
  return out;
}

/** Reads discounts back from the JSON stored on an invoice. */
export function parseStoredDiscounts(value: unknown): RawDiscountInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .map((d) => ({
      name: typeof d.name === 'string' ? d.name : undefined,
      type: typeof d.type === 'string' ? d.type : undefined,
      value: typeof d.value === 'number' || typeof d.value === 'string' ? d.value : undefined,
    }));
}

export function calculateInvoiceTotals(
  rawItems: RawInvoiceItemInput[],
  options: { isGstApplied: boolean; gstRate: number; discounts?: RawDiscountInput[] }
): InvoiceTotals {
  const items = rawItems.map(processInvoiceItem);
  const subtotal = roundCents(items.reduce((sum, item) => sum + item.amount, 0));

  // Discounts come off the subtotal first; GST is then charged on what is left
  const discounts = processDiscounts(subtotal, options.discounts);
  const taxableAmount = discounts.length > 0 ? discounts[discounts.length - 1].priceAfter : subtotal;
  const discountAmount = roundCents(subtotal - taxableAmount);

  const gstRate = options.isGstApplied ? options.gstRate : 0;
  const gstAmount = options.isGstApplied ? roundCents(taxableAmount * (gstRate / 100)) : 0;
  const totalAmount = roundCents(taxableAmount + gstAmount);

  return { items, subtotal, discounts, discountAmount, taxableAmount, gstRate, gstAmount, totalAmount };
}
/** A discount's own name. Blank names, and the generic ones older invoices stored ("10% discount"), read as just "Discount". */
export function discountName(d: { name?: string }): string {
  const raw = d.name?.trim() ?? '';
  return !raw || /^(\d+(\.\d+)?% )?discount$/i.test(raw) ? 'Discount' : raw;
}

/** What the discount takes off, worded for clients: "10% off" or "$100.00 off". */
export function discountTerms(d: { type?: string; value?: number | string }): string {
  const value = Number(d.value) || 0;
  return d.type === 'FLAT' ? `$${value.toFixed(2)} off` : `${value}% off`;
}

/** One consistent line for a discount everywhere: "Early bird (10% off)", "Discount ($100.00 off)". */
export function describeDiscount(d: { name?: string; type?: string; value?: number | string }): string {
  return `${discountName(d)} (${discountTerms(d)})`;
}