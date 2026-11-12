import { describe, it, expect } from 'vitest';
import { renderContractTemplate, CONTRACT_TEMPLATES } from '../contract-templates';

describe('renderContractTemplate', () => {
  it('fills every placeholder', () => {
    const out = renderContractTemplate('{{studio_name}} / {{company_name}} / {{shoot_date}} / {{total_amount}}', {
      studio_name: 'J SQUARE',
      company_name: 'Acme',
      shoot_date: '31 October 2026',
      total_amount: '900.00',
    });
    expect(out).toBe('J SQUARE / Acme / 31 October 2026 / 900.00');
  });

  it('keeps dollar signs in a name or title exactly as typed', () => {
    const out = renderContractTemplate('{{company_name}} - {{project_title}}', {
      company_name: 'Ang $& Sons',
      project_title: 'Launch $1 promo $`',
    });
    expect(out).toBe('Ang $& Sons - Launch $1 promo $`');
  });

  it('names an individual client on their own, and an organisation with its contact person', () => {
    const person = renderContractTemplate('between {{studio_name}} and {{client_party}}.', {
      studio_name: 'J SQUARE',
      client_party: 'Mr Zhun Hung Yong',
    });
    expect(person).toBe('between J SQUARE and Mr Zhun Hung Yong.');
    const org = renderContractTemplate('and {{client_party}}.', { company_name: 'SP Academic Club', client_name: 'Ms Jacqueline Yeo' });
    expect(org).toBe('and SP Academic Club (Attn: Ms Jacqueline Yeo).');
  });

  it('older contract wording with an explicit Attn also drops the Attn for an individual', () => {
    const out = renderContractTemplate('And: {{company_name}} (Attn: {{client_name}})', {
      company_name: 'Zhun Hung Yong',
      client_name: 'Mr Zhun Hung Yong',
      client_party: 'Mr Zhun Hung Yong',
    });
    expect(out).toBe('And: Mr Zhun Hung Yong');
  });

  it('every built-in template names the client party once, via {{client_party}}', () => {
    for (const t of CONTRACT_TEMPLATES) {
      expect(t.body).toContain('{{client_party}}');
      expect(t.body).not.toContain('(Attn: {{client_name}})');
    }
  });

  it('uses a friendly default for anything not supplied', () => {
    expect(renderContractTemplate('Date: {{shoot_date}}', {})).toBe('Date: To be determined');
  });
});
