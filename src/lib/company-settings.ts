import { prisma } from '@/lib/prisma';
import { defaultPaymentConfig, type CompanyPaymentConfig } from '@/lib/payment-config';

export type CompanySettingsView = CompanyPaymentConfig & {
  /** Uploaded static PayNow QR image as a data URL, if any. */
  staticQrDataUrl: string | null;
};

export const SETTINGS_ROW_ID = 'default';

/**
 * The studio's company and payment details. Anything left blank in Settings (or
 * if the table can't be read) falls back to the COMPANY_* environment defaults,
 * so invoices keep working either way.
 */
export async function getCompanySettings(): Promise<CompanySettingsView> {
  let row: Awaited<ReturnType<typeof prisma.companySettings.findUnique>> = null;
  try {
    row = await prisma.companySettings.findUnique({ where: { id: SETTINGS_ROW_ID } });
  } catch (error) {
    console.error('Failed to read company settings, using defaults:', error);
  }

  const pick = (stored: string | null | undefined, fallback: string) =>
    stored && stored.trim() ? stored.trim() : fallback;

  return {
    companyName: pick(row?.companyName, defaultPaymentConfig.companyName),
    uen: pick(row?.uen, defaultPaymentConfig.uen),
    bankName: pick(row?.bankName, defaultPaymentConfig.bankName),
    bankAccountNumber: pick(row?.bankAccountNumber, defaultPaymentConfig.bankAccountNumber),
    // Optional: once Settings has been saved, a blank branch code stays blank instead of reverting to the default
    bankBranchCode: row ? (row.bankBranchCode ?? '').trim() : defaultPaymentConfig.bankBranchCode,
    bankAccountName: pick(row?.bankAccountName, defaultPaymentConfig.bankAccountName),
    gstRegNo: pick(row?.gstRegNo, defaultPaymentConfig.gstRegNo),
    address: pick(row?.address, defaultPaymentConfig.address),
    isGstRegistered: defaultPaymentConfig.isGstRegistered,
    gstRate: defaultPaymentConfig.gstRate,
    staticQrDataUrl: row?.staticQrDataUrl ?? null,
  };
}

/** The payment details without the (large) static QR image, safe to send to the browser. */
export function toPublicPaymentConfig(settings: CompanySettingsView): CompanyPaymentConfig {
  const { staticQrDataUrl: _omit, ...rest } = settings;
  return rest;
}
