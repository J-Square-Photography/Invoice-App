export interface CompanyPaymentConfig {
  companyName: string;
  uen: string;
  bankName: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  bankAccountName: string;
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
  isGstRegistered: true,
  gstRate: 9, // Singapore 9% GST
};
