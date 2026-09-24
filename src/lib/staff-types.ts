export const STAFF_TYPES = ['FT', 'PT', 'FREELANCE'] as const;
export type StaffType = (typeof STAFF_TYPES)[number];

export const STAFF_TYPE_LABELS: Record<StaffType, string> = {
  FT: 'Full-Time',
  PT: 'Part-Time',
  FREELANCE: 'Freelancer',
};

export function isStaffType(value: string): value is StaffType {
  return (STAFF_TYPES as readonly string[]).includes(value);
}

export const PAYSLIP_STATUSES = ['DRAFT', 'PAID'] as const;
export type PayslipStatus = (typeof PAYSLIP_STATUSES)[number];

export function isPayslipStatus(value: string): value is PayslipStatus {
  return (PAYSLIP_STATUSES as readonly string[]).includes(value);
}
