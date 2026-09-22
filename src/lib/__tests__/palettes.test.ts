import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PALETTES, PALETTE_COLOURS, paletteCss, paletteVars, contrast, hslToHex } from '../palettes';

const ids = PALETTES.map((p) => p.id).filter((id) => PALETTE_COLOURS[id]);
const modes = ['light', 'dark'] as const;

describe('palette readability', () => {
  for (const id of ids) {
    for (const mode of modes) {
      describe(`${id} ${mode}`, () => {
        const v = paletteVars(id, mode);
        const card = v['--color-white'];
        const page = v['--color-neutral-50'];

        it('main text is very clear on the page and on cards', () => {
          expect(contrast(v['--color-neutral-900'], card)).toBeGreaterThanOrEqual(11);
          expect(contrast(v['--color-neutral-900'], page)).toBeGreaterThanOrEqual(11);
          expect(contrast(v['--color-neutral-700'], card)).toBeGreaterThanOrEqual(7);
        });

        it('secondary and muted text stays readable', () => {
          expect(contrast(v['--color-neutral-600'], card)).toBeGreaterThanOrEqual(5.5);
          expect(contrast(v['--color-neutral-500'], card)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(v['--color-neutral-500'], page)).toBeGreaterThanOrEqual(4.3);
        });

        it('green, red, blue and amber text is readable on cards and the page', () => {
          for (const name of ['emerald', 'red', 'blue', 'amber']) {
            for (const step of [600, 700, 800, 900]) {
              expect(contrast(v[`--color-${name}-${step}`], card), `${name}-${step} on card`).toBeGreaterThanOrEqual(4.5);
              expect(contrast(v[`--color-${name}-${step}`], page), `${name}-${step} on page`).toBeGreaterThanOrEqual(4.5);
            }
          }
        });

        it('badge fills carry their text (card colour on the 500 step)', () => {
          for (const name of ['emerald', 'red', 'amber']) {
            expect(contrast(v[`--color-${name}-500`], card), `${name}-500`).toBeGreaterThanOrEqual(4.5);
          }
        });

        it('tinted panels keep their dark/light text readable', () => {
          for (const name of ['emerald', 'red', 'blue', 'amber']) {
            expect(contrast(v[`--color-${name}-800`], v[`--color-${name}-50`]), `${name}-800 on ${name}-50`).toBeGreaterThanOrEqual(4.5);
            expect(contrast(v[`--color-${name}-900`], v[`--color-${name}-100`]), `${name}-900 on ${name}-100`).toBeGreaterThanOrEqual(4.5);
          }
        });
      });
    }
  }

  it('light palettes are softer than pure white', () => {
    for (const id of ids) {
      const v = paletteVars(id, 'light');
      expect(v['--color-white']).not.toBe('#ffffff');
      expect(v['--color-neutral-50']).not.toBe('#ffffff');
    }
  });
});

describe('generated palette css', () => {
  it('is up to date with palettes.ts (run: npx tsx scripts/gen-palettes.ts)', () => {
    const file = readFileSync(join(__dirname, '..', '..', 'app', 'palettes.generated.css'), 'utf8');
    expect(file.replace(/\r\n/g, '\n')).toBe(paletteCss());
  });
});

describe('hslToHex', () => {
  it('converts known colours', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    expect(hslToHex(120, 100, 25)).toBe('#008000');
    expect(hslToHex(0, 0, 100)).toBe('#ffffff');
  });
});
