import { describe, it, expect } from 'vitest';
import { computeCRC16, formatTLV, generatePayNowPayload } from '../sgqr';

describe('computeCRC16', () => {
  it('matches the standard CRC-16/CCITT-FALSE check value for "123456789"', () => {
    // Published check value for this exact variant (poly 0x1021, init 0xFFFF,
    // no reflection, no xorout) — see the CRC catalogue entry for CRC-16/CCITT-FALSE.
    expect(computeCRC16('123456789')).toBe('29B1');
  });

  it('always returns a 4-character uppercase hex string', () => {
    const result = computeCRC16('a');
    expect(result).toHaveLength(4);
    expect(result).toBe(result.toUpperCase());
  });
});

describe('formatTLV', () => {
  it('encodes tag, zero-padded length, and value', () => {
    expect(formatTLV('0', '01')).toBe('000201');
  });

  it('pads two-digit length correctly for longer values', () => {
    // "J SQUARE PHOTOGRAPHY" is 20 characters
    expect(formatTLV('59', 'J SQUARE PHOTOGRAPHY')).toBe('5920J SQUARE PHOTOGRAPHY');
  });
});

describe('generatePayNowPayload', () => {
  const baseOptions = {
    uen: '202012345m',
    amount: 150.5,
    reference: 'JSQ-2026-0001',
    merchantName: 'J Square Photography',
  };

  it('produces a payload whose trailing 4 hex chars are a valid CRC16 of the rest', () => {
    const payload = generatePayNowPayload(baseOptions);
    const body = payload.slice(0, -4);
    const checksum = payload.slice(-4);
    expect(computeCRC16(body)).toBe(checksum);
  });

  it('uppercases the UEN and embeds the SG.PAYNOW GUID', () => {
    const payload = generatePayNowPayload(baseOptions);
    expect(payload).toContain('SG.PAYNOW');
    expect(payload).toContain('202012345M');
  });

  it('marks the QR as dynamic (point of initiation 12) when a fixed amount is given', () => {
    const payload = generatePayNowPayload({ ...baseOptions, isEditable: false });
    expect(payload).toContain('010212');
  });

  it('marks the QR as static (point of initiation 11) when no amount is given', () => {
    const payload = generatePayNowPayload({ uen: baseOptions.uen, merchantName: baseOptions.merchantName });
    expect(payload).toContain('010211');
    expect(payload).not.toContain('5406'); // no tag 54 (amount) present
  });

  it('truncates merchant name to 25 characters per EMVCo limit', () => {
    const payload = generatePayNowPayload({
      ...baseOptions,
      merchantName: 'A Very Long Studio Name That Exceeds The Limit',
    });
    expect(payload).not.toContain('EXCEEDS THE LIMIT');
  });
});
