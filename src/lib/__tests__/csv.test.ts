import { describe, it, expect } from 'vitest';
import { toCsv } from '../csv';

describe('toCsv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv([['a,b', 'say "hi"', 'x\ny']])).toBe('"a,b","say ""hi""","x\ny"');
  });

  it('writes empty cells for null and undefined, and keeps numbers as-is', () => {
    expect(toCsv([['A', null, undefined, 12.5]])).toBe('A,,,12.5');
  });

  it('neutralises spreadsheet formulas but leaves numbers alone', () => {
    expect(toCsv([['=SUM(A1)', '+1', '-2', '@x', -5]])).toBe("'=SUM(A1),'+1,'-2,'@x,-5");
  });

  it('separates rows with CRLF', () => {
    expect(toCsv([['a'], ['b']])).toBe('a\r\nb');
  });
});
