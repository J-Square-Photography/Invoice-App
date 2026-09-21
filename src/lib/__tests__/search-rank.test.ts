import { describe, it, expect } from 'vitest';
import { rankClients, rankProjects } from '../search-rank';

const clients = [
  { companyName: 'Zen Studio', contactName: 'Mary Tan', email: 'zen@x.com' },
  { companyName: 'PA', contactName: 'Maguire Lim Wei Bin', email: 'pa@x.com' },
  { companyName: 'Marina Events', contactName: 'Chen', email: 'info@marina.com' },
  { companyName: 'Acme', contactName: 'Jo', email: 'jo@acme.com' },
  { companyName: 'Crumbzup', contactName: 'Sam Marin', email: 'sam@c.com' },
];

describe('rankClients', () => {
  it('a single letter matches names starting with it, ignoring case', () => {
    const names = rankClients(clients, 'm').map((c) => c.companyName);
    // company starts with m -> contact starts with m -> a later word starts with m
    expect(names.slice(0, 4)).toEqual(['Marina Events', 'PA', 'Zen Studio', 'Crumbzup']);
  });

  it('company-name prefix beats contact-name prefix', () => {
    expect(rankClients(clients, 'MA')[0].companyName).toBe('Marina Events');
  });

  it('matches a later word in the contact name', () => {
    expect(rankClients(clients, 'lim')[0].companyName).toBe('PA');
  });

  it('with no query returns everything alphabetically', () => {
    expect(rankClients(clients, '').map((c) => c.companyName)).toEqual(['Acme', 'Crumbzup', 'Marina Events', 'PA', 'Zen Studio']);
  });
});

describe('rankProjects', () => {
  const projects = [{ title: 'Summer Campaign' }, { title: 'School Fair' }, { title: 'Back to School' }, { title: 'Wedding' }];

  it('orders titles starting with the query first, then later words, then the rest', () => {
    expect(rankProjects(projects, 's').map((p) => p.title)).toEqual([
      'School Fair',
      'Summer Campaign',
      'Back to School',
      'Wedding',
    ]);
  });

  it('ignores case', () => {
    expect(rankProjects(projects, 'SCHOOL').map((p) => p.title).slice(0, 2)).toEqual(['School Fair', 'Back to School']);
  });
});