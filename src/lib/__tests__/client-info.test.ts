import { describe, it, expect } from 'vitest';
import { missingClientInfo } from '../client-info';

describe('missingClientInfo', () => {
  it('lists every detail that is blank or missing', () => {
    expect(missingClientInfo({ contactName: '', email: null, phone: '  ', address: undefined })).toEqual([
      'contact person',
      'email',
      'phone',
      'address',
    ]);
  });

  it('reports nothing for a complete client', () => {
    expect(
      missingClientInfo({ contactName: 'Amy Tan', email: 'a@b.sg', phone: '+65 8123 4567', address: '1 Road, Singapore 111111' })
    ).toEqual([]);
  });

  it('never asks an individual for a contact person: they are their own contact', () => {
    expect(missingClientInfo({ clientType: 'INDIVIDUAL', contactName: '', email: 'a@b.sg', phone: '1', address: 'x' })).toEqual([]);
    expect(missingClientInfo({ clientType: 'ORGANISATION', contactName: '', email: 'a@b.sg', phone: '1', address: 'x' })).toEqual([
      'contact person',
    ]);
  });
});
