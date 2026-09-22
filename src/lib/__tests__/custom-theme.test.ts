import { describe, it, expect } from 'vitest';
import { customThemeVars, contrast, hexToHsl, hslToHex, isCustomTheme, DEFAULT_CUSTOM_THEME, type CustomTheme } from '../palettes';

const wild: CustomTheme[] = [
  DEFAULT_CUSTOM_THEME,
  { base: '#ff00ff', green: '#00ff00', red: '#ff0000', blue: '#0000ff', amber: '#ffff00' }, // loudest possible picks
  { base: '#000000', green: '#000000', red: '#000000', blue: '#000000', amber: '#000000' },
  { base: '#ffffff', green: '#ffffff', red: '#ffffff', blue: '#ffffff', amber: '#ffffff' },
  { base: '#123456', green: '#abcdef', red: '#fedcba', blue: '#654321', amber: '#0f0f0f' },
  { base: '#ffe4e1', green: '#98fb98', red: '#ff6347', blue: '#87ceeb', amber: '#ffd700' },
];

describe('custom colours always stay readable', () => {
  for (const [i, theme] of wild.entries()) {
    for (const mode of ['light', 'dark'] as const) {
      it(`pick #${i + 1}, ${mode}`, () => {
        const v = customThemeVars(theme, mode);
        const card = v['--color-white'];
        const page = v['--color-neutral-50'];
        expect(contrast(v['--color-neutral-900'], card)).toBeGreaterThanOrEqual(10);
        expect(contrast(v['--color-neutral-700'], card)).toBeGreaterThanOrEqual(6.5);
        expect(contrast(v['--color-neutral-500'], card)).toBeGreaterThanOrEqual(4.4);
        expect(contrast(v['--color-neutral-500'], page)).toBeGreaterThanOrEqual(4.1);
        for (const name of ['emerald', 'red', 'blue', 'amber']) {
          for (const step of [600, 700, 800, 900]) {
            expect(contrast(v[`--color-${name}-${step}`], card), `${name}-${step}`).toBeGreaterThanOrEqual(4.5);
          }
          expect(contrast(v[`--color-${name}-500`], card), `${name}-500`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }

  it('softens the page: a pure-white or pure-black pick never gives a stark background', () => {
    const light = customThemeVars({ ...DEFAULT_CUSTOM_THEME, base: '#ffffff' }, 'light');
    expect(light['--color-neutral-50']).not.toBe('#ffffff');
    const dark = customThemeVars({ ...DEFAULT_CUSTOM_THEME, base: '#000000' }, 'dark');
    expect(dark['--color-neutral-50']).not.toBe('#000000');
  });

  it('provides every variable the app uses', () => {
    const v = customThemeVars(DEFAULT_CUSTOM_THEME, 'light');
    for (const name of ['neutral', 'emerald', 'green', 'red', 'blue', 'amber']) {
      for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
        expect(v[`--color-${name}-${step}`], `${name}-${step}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect(v['--color-white']).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('colour helpers', () => {
  it('validates a saved custom theme', () => {
    expect(isCustomTheme(DEFAULT_CUSTOM_THEME)).toBe(true);
    expect(isCustomTheme({ ...DEFAULT_CUSTOM_THEME, red: 'red' })).toBe(false);
    expect(isCustomTheme(null)).toBe(false);
    expect(isCustomTheme({ base: '#ffffff' })).toBe(false);
  });

  it('converts hex to hue/saturation and back', () => {
    const { h, s, l } = hexToHsl('#3366cc');
    expect(hslToHex(h, s, l)).toBe('#3366cc');
    expect(hexToHsl('not a colour')).toEqual({ h: 0, s: 0, l: 50.19607843137255 });
  });
});
