import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from '../safe-redirect';

describe('safeRedirectPath', () => {
  it('keeps normal admin paths', () => {
    expect(safeRedirectPath('/admin')).toBe('/admin');
    expect(safeRedirectPath('/admin/invoices')).toBe('/admin/invoices');
    expect(safeRedirectPath('/admin/clients?view=abc')).toBe('/admin/clients?view=abc');
  });

  it('falls back to the dashboard for anything else', () => {
    expect(safeRedirectPath(null)).toBe('/admin');
    expect(safeRedirectPath('')).toBe('/admin');
    expect(safeRedirectPath('https://evil.example')).toBe('/admin');
    expect(safeRedirectPath('//evil.example')).toBe('/admin');
    expect(safeRedirectPath('/\\evil.example')).toBe('/admin');
    expect(safeRedirectPath('/administrator')).toBe('/admin');
    expect(safeRedirectPath('/admin//evil.example')).toBe('/admin');
    expect(safeRedirectPath('/login')).toBe('/admin');
  });
});
