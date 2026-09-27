import { describe, it, expect } from 'vitest';
import { appendInternalNote } from '../internal-notes';

describe('appendInternalNote', () => {
  it('starts a fresh log when there are no existing notes', () => {
    expect(appendInternalNote(null, 'Voided by test@example.com.')).toMatch(/^\[.+\] Voided by test@example\.com\.$/);
    expect(appendInternalNote(undefined, 'Voided by test@example.com.')).toMatch(/^\[.+\]/);
  });

  it('appends onto existing notes on a new line, keeping earlier entries', () => {
    const result = appendInternalNote('Converted from quotation QUO-2026-8K3F91.', 'Voided by test@example.com.');
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('Converted from quotation QUO-2026-8K3F91.');
    expect(lines[1]).toMatch(/^\[.+\] Voided by test@example\.com\.$/);
  });
});
