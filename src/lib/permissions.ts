/**
 * Delegable, per-section access for MANAGER accounts. SUPER_ADMIN ("Developer") always has full
 * access to everything, including Team management, which is intentionally not a permission key:
 * granting someone control over other people's logins is not something a Custom preset should be
 * able to hand out.
 */
export const PERMISSION_KEYS = [
  'clients',
  'projects',
  'quotes',
  'invoices',
  'payments',
  'contracts',
  'alerts',
  'settings',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, { name: string; description: string }> = {
  clients: { name: 'Clients', description: 'View and edit client records' },
  projects: { name: 'Projects', description: 'View and manage projects' },
  quotes: { name: 'Quotes', description: 'View and send quotations' },
  invoices: { name: 'Invoices', description: 'View and manage invoices' },
  payments: { name: 'Payments', description: 'View and record payments' },
  contracts: { name: 'Contracts', description: 'View and manage contracts' },
  alerts: { name: 'Alerts', description: 'View overdue-invoice alerts' },
  settings: { name: 'Settings', description: 'Company details, bank account, PayNow QR' },
};

/** Day-to-day operational areas. Deliberately excludes Settings (bank/PayNow details) and Contracts. */
export const ESSENTIALS_PERMISSIONS: PermissionKey[] = ['clients', 'projects', 'quotes', 'invoices', 'payments'];

export const ALL_PERMISSIONS: PermissionKey[] = [...PERMISSION_KEYS];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

/** Keeps only recognised keys and drops duplicates, so stray/old values can never grant something new. */
export function sanitizePermissions(values: unknown): PermissionKey[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<PermissionKey>();
  for (const v of values) {
    if (typeof v === 'string' && isPermissionKey(v)) unique.add(v);
  }
  return [...unique];
}

export interface PermissionUser {
  role: string;
  permissions?: string[];
}

/** SUPER_ADMIN always passes. A MANAGER needs the key in their granted list. */
export function hasPermission(user: PermissionUser | null | undefined, key: PermissionKey): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return Array.isArray(user.permissions) && user.permissions.includes(key);
}
