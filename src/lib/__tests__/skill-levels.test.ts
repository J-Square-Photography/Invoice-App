import { describe, it, expect } from 'vitest';
import { sanitizeSkills } from '../skill-levels';

describe('sanitizeSkills', () => {
  it('keeps a valid discipline/level pair', () => {
    expect(sanitizeSkills([{ discipline: 'Photography', level: 'Enthusiast' }])).toEqual([
      { discipline: 'Photography', level: 'Enthusiast' },
    ]);
  });

  it('drops unrecognised disciplines and levels', () => {
    expect(sanitizeSkills([{ discipline: 'Photography', level: 'Wizard' }, { discipline: 'Drone', level: 'Novice' }])).toEqual([]);
  });

  it('drops entries with a blank level (not trained)', () => {
    expect(sanitizeSkills([{ discipline: 'Photography', level: '' }])).toEqual([]);
  });

  it('keeps only the last level per discipline if duplicated', () => {
    expect(
      sanitizeSkills([
        { discipline: 'Photography', level: 'Beginner' },
        { discipline: 'Photography', level: 'Director' },
      ])
    ).toEqual([{ discipline: 'Photography', level: 'Director' }]);
  });

  it('returns entries in a stable discipline order regardless of input order', () => {
    expect(
      sanitizeSkills([
        { discipline: 'Videography', level: 'Novice' },
        { discipline: 'Photography', level: 'Professional' },
      ])
    ).toEqual([
      { discipline: 'Photography', level: 'Professional' },
      { discipline: 'Videography', level: 'Novice' },
    ]);
  });

  it('is empty for non-array input', () => {
    expect(sanitizeSkills(null)).toEqual([]);
    expect(sanitizeSkills(undefined)).toEqual([]);
    expect(sanitizeSkills('Photography')).toEqual([]);
  });
});
