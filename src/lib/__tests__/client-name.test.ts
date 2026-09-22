import { describe, it, expect } from 'vitest';
import { composeContactName } from '../client-name';
import { SALUTATIONS, isPresetSalutation } from '../salutations';

describe('composeContactName', () => {
  it('joins salutation, given name and family name in order', () => {
    expect(composeContactName({ salutation: 'Mr', firstName: 'Wei Ming', lastName: 'Tan' })).toBe('Mr Wei Ming Tan');
  });

  it('works with a family name left blank (mononym / no-surname clients)', () => {
    expect(composeContactName({ salutation: 'Mdm', firstName: 'Siti', lastName: '' })).toBe('Mdm Siti');
    expect(composeContactName({ firstName: 'Charmaine' })).toBe('Charmaine');
  });

  it('works with no salutation', () => {
    expect(composeContactName({ firstName: 'Amy', lastName: 'Tan' })).toBe('Amy Tan');
  });

  it('is empty when every part is empty, null or whitespace', () => {
    expect(composeContactName({})).toBe('');
    expect(composeContactName({ salutation: '', firstName: null, lastName: '   ' })).toBe('');
  });

  it('trims each part and collapses to single spaces between them', () => {
    expect(composeContactName({ salutation: '  Dr ', firstName: ' Amy ', lastName: ' Tan  ' })).toBe('Dr Amy Tan');
  });
});

describe('salutation presets', () => {
  it('includes Mdm, distinct from Mrs, for the Singapore context', () => {
    expect(SALUTATIONS).toContain('Mdm');
    expect(SALUTATIONS).toContain('Mrs');
  });

  it('detects a preset vs. a free-typed "Other" title', () => {
    expect(isPresetSalutation('Dr')).toBe(true);
    expect(isPresetSalutation('Datuk')).toBe(false);
    expect(isPresetSalutation('')).toBe(false);
  });
});
