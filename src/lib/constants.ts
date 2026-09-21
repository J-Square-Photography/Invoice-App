export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MANAGER: 'MANAGER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PROJECT_TYPES = {
  PORTRAIT: 'PORTRAIT',
  COMMERCIAL_VIDEO: 'COMMERCIAL_VIDEO',
  WORKSHOP: 'WORKSHOP',
  EVENT: 'EVENT',
  PHOTOBOOTH: 'PHOTOBOOTH',
  OTHER: 'OTHER',
} as const;

export type ProjectType = (typeof PROJECT_TYPES)[keyof typeof PROJECT_TYPES];

export const PIPELINE_STATUSES = {
  INQUIRY: 'INQUIRY',
  QUOTED: 'QUOTED',
  BOOKED: 'BOOKED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  CLOSED: 'CLOSED',
} as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[keyof typeof PIPELINE_STATUSES];

export const INVOICE_STATUSES = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  VOID: 'VOID',
} as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[keyof typeof INVOICE_STATUSES];

export const PAYMENT_METHODS = {
  BANK_TRANSFER: 'BANK_TRANSFER',
  PAYNOW_UEN: 'PAYNOW_UEN',
  PAYNOW_QR: 'PAYNOW_QR',
  PAYNOW_STATIC_QR: 'PAYNOW_STATIC_QR',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

// Display labels for UI
export const PROJECT_TYPE_LABELS: Record<string, string> = {
  PORTRAIT: 'Portrait Photography',
  COMMERCIAL_VIDEO: 'Commercial Videography',
  WORKSHOP: 'Training Workshop',
  EVENT: 'Event Coverage',
  PHOTOBOOTH: 'Photobooth Event',
  OTHER: 'Other',
};

export const PIPELINE_STATUS_LABELS: Record<string, string> = {
  INQUIRY: 'Inquiry',
  QUOTED: 'Quoted',
  BOOKED: 'Booked',
  IN_PROGRESS: 'In Progress',
  DELIVERED: 'Delivered',
  CLOSED: 'Closed',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  PARTIAL: 'Partial Payment',
  PAID: 'Paid',
  VOID: 'Void',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer',
  PAYNOW_UEN: 'PayNow (UEN)',
  PAYNOW_QR: 'PayNow (QR Code)',
  PAYNOW_STATIC_QR: 'PayNow (Static QR)',
};
