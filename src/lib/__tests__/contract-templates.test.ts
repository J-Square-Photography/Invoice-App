import { describe, it, expect } from 'vitest';
import { renderContractTemplate } from '../contract-templates';

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

  it('uses a friendly default for anything not supplied', () => {
    expect(renderContractTemplate('Date: {{shoot_date}}', {})).toBe('Date: To be determined');
  });
});
