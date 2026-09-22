import { describe, it, expect } from 'vitest';
import { invoiceMessage, invoiceSubject, whatsappNumber, whatsappUrl, mailtoUrl, quoteMessage, quoteSubject } from '../share-invoice';

const base = {
  companyName: 'J Square Photography',
  clientName: 'Admiralty Youth Network',
  invoiceNumber: 'JSQ-2026-0008',
  projectTitle: 'Youth Fest Paw Party 2026',
  balanceDue: 600,
  totalAmount: 600,
  dueDate: new Date('2026-08-05'),
  payNowUen: '202012345M',
};

describe('share invoice', () => {
  it('writes a friendly message with amount, due date and PayNow', () => {
    const msg = invoiceMessage({ ...base, contactName: 'Amy' });
    expect(msg).toContain('Hi Amy,');
    expect(msg).toContain('JSQ-2026-0008');
    expect(msg).toContain('Amount due: SGD $600.00');
    expect(msg).toContain('UEN 202012345M');
  });

  it('falls back to the client name and shows the balance for part-paid invoices', () => {
    const msg = invoiceMessage({ ...base, balanceDue: 200, totalAmount: 600 });
    expect(msg).toContain('Hi Admiralty Youth Network,');
    expect(msg).toContain('Balance due: SGD $200.00 (invoice total SGD $600.00)');
  });

  it('titles GST invoices as tax invoices', () => {
    expect(invoiceSubject({ ...base, isTaxInvoice: true })).toBe('Tax Invoice JSQ-2026-0008 from J Square Photography');
    expect(invoiceSubject(base)).toBe('Invoice JSQ-2026-0008 from J Square Photography');
  });

  it('turns phone numbers into WhatsApp format', () => {
    expect(whatsappNumber('+65 8931 2478')).toBe('6589312478');
    expect(whatsappNumber('8931 2478')).toBe('6589312478');
    expect(whatsappNumber('+44 7700 900123')).toBe('447700900123');
    expect(whatsappNumber(null)).toBe('');
  });

  it('encodes the message in the links', () => {
    expect(whatsappUrl('+65 8931 2478', 'a b\nc')).toBe('https://wa.me/6589312478?text=a%20b%0Ac');
    expect(mailtoUrl('a@b.sg', 'Hi there', 'x&y')).toBe('mailto:a@b.sg?subject=Hi%20there&body=x%26y');
    expect(mailtoUrl(null, 's', 'b')).toBe('mailto:?subject=s&body=b');
  });
});

describe('share quotation', () => {
  const q = {
    companyName: 'J Square Photography',
    clientName: 'Ms Taly',
    quoteNumber: 'QUO-2026-0001',
    projectTitle: 'Baby Angel Recital',
    totalAmount: 900,
    validUntil: new Date('2026-10-21'),
  };

  it('writes a quotation message with the total and how long it is valid', () => {
    const msg = quoteMessage({ ...q, contactName: 'Taly' });
    expect(msg).toContain('Hi Taly,');
    expect(msg).toContain('quotation QUO-2026-0001 for Baby Angel Recital');
    expect(msg).toContain('Quoted total: SGD $900.00');
    expect(msg).toContain('Valid until: 21 Oct 2026');
    expect(quoteSubject(q)).toBe('Quotation QUO-2026-0001 from J Square Photography');
  });
});
