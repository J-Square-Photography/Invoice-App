import { describe, it, expect } from 'vitest';
import { makeSnapshot, parseSnapshot, resolveCompany } from '../payment-snapshot';
import type { CompanySettingsView } from '../company-settings';

const live: CompanySettingsView = {
  companyName: 'New Name',
  uen: '201912345A',
  bankName: 'OCBC Bank',
  bankAccountNumber: '999-000111-2',
  bankBranchCode: '501',
  bankAccountName: 'NEW NAME',
  gstRegNo: 'M90376150R',
  address: '1 Test Road, Singapore 123456',
  isGstRegistered: true,
  gstRate: 9,
  staticQrDataUrl: 'data:image/png;base64,AAAA',
};

describe('payment snapshot', () => {
  it('a draft (no snapshot) follows the live settings', () => {
    const result = resolveCompany({ paymentSnapshot: null }, live);
    expect(result.frozen).toBe(false);
    expect(result.uen).toBe('201912345A');
    expect(result.bankAccountNumber).toBe('999-000111-2');
  });

  it('a frozen invoice keeps its own details after settings change', () => {
    const old: CompanySettingsView = { ...live, companyName: 'Old Name', uen: '202012345M', bankAccountNumber: '012-345678-9' };
    const snapshot = makeSnapshot(old, 'PAYNOW_QR');

    const result = resolveCompany({ paymentSnapshot: snapshot }, live);
    expect(result.frozen).toBe(true);
    expect(result.companyName).toBe('Old Name');
    expect(result.uen).toBe('202012345M');
    expect(result.bankAccountNumber).toBe('012-345678-9');
  });

  it('only stores the static QR when the invoice uses the static QR method', () => {
    expect(makeSnapshot(live, 'PAYNOW_QR').staticQrDataUrl).toBeNull();
    expect(makeSnapshot(live, 'PAYNOW_STATIC_QR').staticQrDataUrl).toBe('data:image/png;base64,AAAA');
  });

  it('a frozen static-QR invoice keeps the QR it was issued with', () => {
    const snapshot = makeSnapshot(live, 'PAYNOW_STATIC_QR');
    const changed: CompanySettingsView = { ...live, staticQrDataUrl: 'data:image/png;base64,BBBB' };
    expect(resolveCompany({ paymentSnapshot: snapshot }, changed).staticQrDataUrl).toBe('data:image/png;base64,AAAA');
  });

  it('ignores malformed snapshots and falls back to live settings', () => {
    expect(parseSnapshot({ companyName: 'x' })).toBeNull();
    expect(parseSnapshot('nope')).toBeNull();
    expect(resolveCompany({ paymentSnapshot: { uen: 5 } }, live).frozen).toBe(false);
  });

  it('freezes the GST registration number with the invoice', () => {
    const snapshot = makeSnapshot(live, 'PAYNOW_QR');
    expect(snapshot.gstRegNo).toBe('M90376150R');
    const changed: CompanySettingsView = { ...live, gstRegNo: 'M11111111X' };
    expect(resolveCompany({ paymentSnapshot: snapshot }, changed).gstRegNo).toBe('M90376150R');
  });

  it('a snapshot saved before the GST number existed falls back to the current one', () => {
    const { gstRegNo: _omit, ...older } = makeSnapshot(live, 'PAYNOW_QR');
    expect(resolveCompany({ paymentSnapshot: older }, live).gstRegNo).toBe('M90376150R');
  });
});

describe('sample payment details', () => {
  it('flags the built-in sample UEN and bank account, and only those', async () => {
    const { usesSamplePaymentDetails } = await import('../payment-config');
    expect(usesSamplePaymentDetails({ uen: '202012345M', bankAccountNumber: '111-222333-4' })).toBe(true);
    expect(usesSamplePaymentDetails({ uen: '201912345a', bankAccountNumber: '012-345678-9' })).toBe(true);
    expect(usesSamplePaymentDetails({ uen: '202012345m', bankAccountNumber: '111' })).toBe(true);
    expect(usesSamplePaymentDetails({ uen: '201912345A', bankAccountNumber: '111-222333-4' })).toBe(false);
  });
});
