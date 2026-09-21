import type { Prisma } from '@prisma/client';
import type { CompanySettingsView } from '@/lib/company-settings';

/**
 * The company/bank details as they were when an invoice was issued. Clients pay
 * against these, so once an invoice has been sent they must not change when
 * Settings do. While an invoice is still a DRAFT there is no snapshot and it
 * follows Settings.
 */
export interface PaymentSnapshot {
  companyName: string;
  uen: string;
  bankName: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  bankAccountName: string;
  /** Added later: older snapshots don't have it. */
  gstRegNo?: string;
  address?: string;
  /** Only stored when the invoice uses the static PayNow QR method. */
  staticQrDataUrl?: string | null;
  frozenAt: string;
}

const REQUIRED_STRING_KEYS = [
  'companyName',
  'uen',
  'bankName',
  'bankAccountNumber',
  'bankBranchCode',
  'bankAccountName',
] as const;

export function makeSnapshot(live: CompanySettingsView, paymentMethod: string | null | undefined): PaymentSnapshot {
  return {
    companyName: live.companyName,
    uen: live.uen,
    bankName: live.bankName,
    bankAccountNumber: live.bankAccountNumber,
    bankBranchCode: live.bankBranchCode,
    bankAccountName: live.bankAccountName,
    gstRegNo: live.gstRegNo,
    address: live.address,
    staticQrDataUrl: paymentMethod === 'PAYNOW_STATIC_QR' ? live.staticQrDataUrl : null,
    frozenAt: new Date().toISOString(),
  };
}

/** Prisma wants JSON values as InputJsonValue. */
export function snapshotForDb(snapshot: PaymentSnapshot): Prisma.InputJsonValue {
  return snapshot as unknown as Prisma.InputJsonValue;
}

export function parseSnapshot(value: unknown): PaymentSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  for (const key of REQUIRED_STRING_KEYS) {
    if (typeof v[key] !== 'string') return null;
  }
  return v as unknown as PaymentSnapshot;
}

/**
 * The company details to show for an invoice: its frozen snapshot if it has one,
 * otherwise the live Settings (drafts).
 */
export function resolveCompany(
  invoice: { paymentSnapshot?: unknown },
  live: CompanySettingsView
): CompanySettingsView & { frozen: boolean } {
  const snap = parseSnapshot(invoice.paymentSnapshot);
  if (!snap) return { ...live, frozen: false };
  return {
    ...live,
    companyName: snap.companyName,
    uen: snap.uen,
    bankName: snap.bankName,
    bankAccountNumber: snap.bankAccountNumber,
    bankBranchCode: snap.bankBranchCode,
    bankAccountName: snap.bankAccountName,
    // A business's GST number is a fact about the supplier, so older snapshots use the current one
    gstRegNo: snap.gstRegNo ?? live.gstRegNo,
    address: snap.address ?? live.address,
    staticQrDataUrl: snap.staticQrDataUrl ?? null,
    frozen: true,
  };
}
