import { describe, it, expect } from 'vitest';
import { deriveStatus, toCents } from '../invoice-status';

describe('toCents', () => {
  it('avoids floating point drift', () => {
    expect(toCents(401.12)).toBe(40112);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents('19.99')).toBe(1999);
  });
});

describe('deriveStatus (status follows payments)', () => {
  it('is PAID as soon as every cent is paid', () => {
    expect(deriveStatus('SENT', 401.12, 401.12)).toBe('PAID');
    expect(deriveStatus('PARTIAL', 401.12, 401.12)).toBe('PAID');
  });

  it('is PARTIAL while something is still owed', () => {
    expect(deriveStatus('SENT', 100, 401.12)).toBe('PARTIAL');
    expect(deriveStatus('DRAFT', 0.01, 401.12)).toBe('PARTIAL');
  });

  it('a one-cent shortfall is still PARTIAL, not PAID', () => {
    expect(deriveStatus('SENT', 401.11, 401.12)).toBe('PARTIAL');
  });

  it('never lets a fully paid invoice stay SENT', () => {
    expect(deriveStatus('SENT', 401.13, 401.12)).toBe('PAID');
  });

  it('reopens as SENT when payments are cleared', () => {
    expect(deriveStatus('PAID', 0, 401.12)).toBe('SENT');
    expect(deriveStatus('PARTIAL', 0, 401.12)).toBe('SENT');
  });

  it('leaves unpaid DRAFT/SENT alone and VOID always stays VOID', () => {
    expect(deriveStatus('DRAFT', 0, 401.12)).toBe('DRAFT');
    expect(deriveStatus('SENT', 0, 401.12)).toBe('SENT');
    expect(deriveStatus('VOID', 401.12, 401.12)).toBe('VOID');
  });
});
