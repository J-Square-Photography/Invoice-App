export interface CompanyPaymentConfig {
  companyName: string;
  uen: string;
  bankName: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  bankAccountName: string;
  /** GST registration number, shown on tax invoices. Empty until set in Settings. */
  gstRegNo: string;
  /** Business address printed on invoices. Empty until set in Settings. */
  address: string;
  isGstRegistered: boolean;
  gstRate: number;
}

export const defaultPaymentConfig: CompanyPaymentConfig = {
  companyName: process.env.COMPANY_NAME || 'J Square Photography',
  uen: process.env.COMPANY_UEN || '202012345M', // Replace with official Singapore UEN
  bankName: process.env.COMPANY_BANK_NAME || 'DBS Bank Ltd',
  bankAccountNumber: process.env.COMPANY_BANK_ACCOUNT || '012-345678-9',
  bankBranchCode: process.env.COMPANY_BANK_BRANCH_CODE || '012',
  bankAccountName: process.env.COMPANY_BANK_ACCOUNT_NAME || 'J SQUARE PHOTOGRAPHY',
  gstRegNo: process.env.COMPANY_GST_REG_NO || '',
  address: process.env.COMPANY_ADDRESS || '',
  isGstRegistered: true,
  gstRate: 9, // Singapore 9% GST
};
