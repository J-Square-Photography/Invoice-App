import { describe, it, expect } from 'vitest';
import { composeContactName, billToName, attnName, contractPartyName, individualListName, parseClientType } from '../client-name';
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

describe('individual vs organisation clients on documents', () => {
  const org = { clientType: 'ORGANISATION', companyName: 'SP Academic Club', contactName: 'Ms Jacqueline Yeo', contactRole: 'Teacher-in-charge' };
  const person = { clientType: 'INDIVIDUAL', companyName: 'Zhun Hung Yong', contactName: 'Mr Zhun Hung Yong' };

  it('bills an organisation by its name, to the attention of its contact person and role', () => {
    expect(billToName(org)).toBe('SP Academic Club');
    expect(attnName(org)).toBe('Ms Jacqueline Yeo, Teacher-in-charge');
    expect(attnName({ ...org, contactRole: '' })).toBe('Ms Jacqueline Yeo');
    expect(contractPartyName(org)).toBe('SP Academic Club (Attn: Ms Jacqueline Yeo, Teacher-in-charge)');
  });

  it('bills an individual by their full name with salutation, with no Attn line', () => {
    expect(billToName(person)).toBe('Mr Zhun Hung Yong');
    expect(attnName(person)).toBe('');
    expect(contractPartyName(person)).toBe('Mr Zhun Hung Yong');
  });

  it('an organisation with no contact recorded is named alone, and older clients count as organisations', () => {
    expect(contractPartyName({ companyName: 'Music Zoo', contactName: '' })).toBe('Music Zoo');
    expect(attnName({ companyName: 'Acme', contactName: 'Amy' })).toBe('Amy');
  });

  it('lists an individual without the salutation, so names sort by the person, not by "Mr"/"Ms"', () => {
    expect(individualListName({ salutation: 'Mr', firstName: 'Zhun Hung', lastName: 'Yong' })).toBe('Zhun Hung Yong');
  });

  it('accepts only the two known client types', () => {
    expect(parseClientType('INDIVIDUAL')).toBe('INDIVIDUAL');
    expect(parseClientType('ORGANISATION')).toBe('ORGANISATION');
    expect(parseClientType('company')).toBeNull();
    expect(parseClientType(undefined)).toBeNull();
  });
});
