import { describe, it, expect } from 'vitest';
import { splitPhone, compose, COUNTRIES } from '../phone-input';

const sg = COUNTRIES.find((c) => c.iso === 'SG')!;
const my = COUNTRIES.find((c) => c.iso === 'MY')!;

describe('phone input parsing', () => {
  it('splits a stored number into country and local number', () => {
    const r = splitPhone('+65 9123 4567');
    expect(r.country.iso).toBe('SG');
    expect(r.national).toBe('9123 4567');
  });

  it('recognises longer codes before shorter ones', () => {
    expect(splitPhone('+886 912345678').country.iso).toBe('TW');
    expect(splitPhone('+673 2345678').country.iso).toBe('BN');
    expect(splitPhone('+60 123456789').country.iso).toBe('MY');
  });

  it('treats an older number with no country code as local (Singapore by default)', () => {
    const r = splitPhone('12345678');
    expect(r.country.iso).toBe('SG');
    expect(r.national).toBe('12345678');
  });

  it('an empty value gives Singapore and an empty number', () => {
    const r = splitPhone('');
    expect(r.country.iso).toBe('SG');
    expect(r.national).toBe('');
  });

  it('keeps the chosen country when two share a code (+1)', () => {
    expect(splitPhone('+1 4165550123', 'CA').country.iso).toBe('CA');
    expect(splitPhone('+1 4165550123').country.iso).toBe('US');
  });

  it('composes back to a single string, and to empty when there is no number', () => {
    expect(compose(sg, ' 9123 4567 ')).toBe('+65 9123 4567');
    expect(compose(my, '123456789')).toBe('+60 123456789');
    expect(compose(sg, '')).toBe('');
    expect(compose(sg, '   ')).toBe('');
  });
});