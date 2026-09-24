import { describe, it, expect } from 'vitest';
import { sanitizeSkills, sanitizeExtraSkills } from '../skill-levels';

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

describe('sanitizeExtraSkills', () => {
  const categories = [
    { id: 'cat-1', options: ['Main', 'Assistant'] },
    { id: 'cat-2', options: ['Basic', 'Advanced'] },
  ];

  it('keeps a tag whose category and value both exist', () => {
    expect(sanitizeExtraSkills([{ categoryId: 'cat-1', value: 'Main' }], categories)).toEqual([{ categoryId: 'cat-1', value: 'Main' }]);
  });

  it('drops a tag for a category that no longer exists', () => {
    expect(sanitizeExtraSkills([{ categoryId: 'cat-9', value: 'Main' }], categories)).toEqual([]);
  });

  it('drops a tag whose value is not one of that category\'s options', () => {
    expect(sanitizeExtraSkills([{ categoryId: 'cat-1', value: 'Wizard' }], categories)).toEqual([]);
  });

  it('keeps only the last value per category if duplicated', () => {
    expect(
      sanitizeExtraSkills(
        [
          { categoryId: 'cat-1', value: 'Main' },
          { categoryId: 'cat-1', value: 'Assistant' },
        ],
        categories
      )
    ).toEqual([{ categoryId: 'cat-1', value: 'Assistant' }]);
  });

  it('is empty for non-array input', () => {
    expect(sanitizeExtraSkills(null, categories)).toEqual([]);
    expect(sanitizeExtraSkills(undefined, categories)).toEqual([]);
  });
});
