/**
 * Colour palettes for the app, each with a light and a dark version. The app is styled with
 * Tailwind's neutral scale plus red / emerald / blue / amber, which Tailwind v4 reads from CSS
 * variables, so re-defining those variables re-colours every page at once.
 *
 * The CSS for these palettes lives in src/app/palettes.generated.css. It is produced from this
 * file by `npx tsx scripts/gen-palettes.ts`, and a test (palettes.test.ts) checks that text stays
 * readable on every palette (contrast) and that the generated CSS is up to date.
 */
export type Mode = 'light' | 'dark';

export interface PaletteInfo {
  id: string;
  name: string;
  description: string;
}

export const PALETTES: PaletteInfo[] = [
  { id: 'cozy', name: 'Cozy', description: 'Warm cream and soft browns, easy on the eyes' },
  { id: 'mist', name: 'Mist', description: 'Calm blue-grey, cool and quiet' },
  { id: 'sage', name: 'Sage', description: 'Gentle green-grey, natural and fresh' },
  { id: 'rose', name: 'Rose', description: 'Soft blush pink, gentle and warm' },
  { id: 'ocean', name: 'Ocean', description: 'Fresh aqua-teal, light and airy' },
  { id: 'lavender', name: 'Lavender', description: 'Calm violet-grey, soft and modern' },
  { id: 'slate', name: 'Slate', description: 'Neutral cool grey, plain and professional' },
  { id: 'classic', name: 'Classic', description: 'The original crisp white and neutral grey' },
];

export const DEFAULT_PALETTE = 'cozy';

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
type Step = (typeof STEPS)[number];

/** Neutral scale: --color-white is the card/panel colour and 50 is the page background. */
interface Neutrals {
  white: string;
  scale: Record<Step, string>;
}

const n = (white: string, hexes: string[]): Neutrals => ({
  white,
  scale: Object.fromEntries(STEPS.map((s, i) => [s, hexes[i]])) as Record<Step, string>,
});

interface AccentRecipe {
  emerald: [number, number]; // hue, saturation (%)
  red: [number, number];
  blue: [number, number];
  amber: [number, number];
}

interface PaletteColours {
  light: Neutrals;
  dark: Neutrals;
  accents: AccentRecipe;
}

// ---------- colour maths ----------
export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (nn: number) => (nn + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (nn: number) => light - a * Math.max(-1, Math.min(k(nn) - 3, Math.min(9 - k(nn), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

/** hue 0-360, saturation 0-100, lightness 0-100 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#808080';
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s: s * 100, l: l * 100 };
}

/**
 * Neutral scale for any tint: the same lightness steps as the hand-picked palettes, coloured by a
 * hue and a small saturation. Used for the extra presets and for the custom palette.
 */
export function generateNeutrals(hue: number, tint: number, mode: Mode): Neutrals {
  const s = Math.max(0, Math.min(30, tint));
  // saturation each step keeps: strongest in the mid-tones, calmer at the very light/dark ends
  const light: Array<[number, number]> = [[95, 0.85], [91, 0.9], [85, 0.9], [76, 0.85], [55, 0.7], [41, 0.7], [33, 0.75], [25, 0.8], [18, 0.85], [12, 0.9], [7, 0.9]];
  const dark: Array<[number, number]> = [[7.5, 0.9], [15, 0.85], [21, 0.8], [29, 0.75], [52, 0.6], [67, 0.6], [76, 0.65], [84, 0.7], [91, 0.7], [96, 0.7], [99, 0.6]];
  const ramp = mode === 'light' ? light : dark;
  const card = mode === 'light' ? hslToHex(hue, s * 0.7, 98.5) : hslToHex(hue, s * 0.85, 11);
  return { white: card, scale: Object.fromEntries(STEPS.map((step, i) => [step, hslToHex(hue, s * ramp[i][1], ramp[i][0])])) as Record<Step, string> };
}

const generated = (hue: number, tint: number, accents: AccentRecipe): PaletteColours => ({
  light: generateNeutrals(hue, tint, 'light'),
  dark: generateNeutrals(hue, tint, 'dark'),
  accents,
});

// Neutral steps in order: 50 100 200 300 400 500 600 700 800 900 950
export const PALETTE_COLOURS: Record<string, PaletteColours> = {
  rose: generated(350, 22, { emerald: [150, 28], red: [352, 46], blue: [215, 36], amber: [34, 55] }),
  ocean: generated(195, 26, { emerald: [165, 32], red: [5, 44], blue: [200, 50], amber: [38, 54] }),
  lavender: generated(262, 22, { emerald: [155, 28], red: [345, 44], blue: [235, 42], amber: [36, 52] }),
  slate: generated(215, 8, { emerald: [152, 30], red: [4, 44], blue: [214, 44], amber: [38, 54] }),
  cozy: {
    light: n('#fbf8f2', ['#f3eee4', '#ebe4d6', '#ddd3c0', '#c9bda6', '#9b8e79', '#6f6555', '#5a5142', '#463e32', '#322b22', '#211c16', '#14110d']),
    dark: n('#211c16', ['#17130f', '#2b251d', '#3a332a', '#4d453a', '#85796a', '#aa9f8e', '#c4baa9', '#d8cfbf', '#e9e2d4', '#f6f0e4', '#fffaf0']),
    accents: { emerald: [152, 30], red: [8, 46], blue: [208, 38], amber: [36, 55] },
  },
  mist: {
    light: n('#f9fafc', ['#eef1f6', '#e4e8ef', '#d5dbe6', '#bac3d2', '#8894a8', '#5d6a80', '#4b576b', '#394356', '#283040', '#1a2130', '#0f1420']),
    dark: n('#1b2230', ['#131824', '#242c3c', '#323b4e', '#444f65', '#7784a0', '#9ba8c0', '#b5c0d5', '#ccd4e4', '#e1e6f0', '#f3f5fa', '#ffffff']),
    accents: { emerald: [158, 30], red: [355, 42], blue: [217, 46], amber: [38, 52] },
  },
  sage: {
    light: n('#fafbf7', ['#eef1e9', '#e4e8dc', '#d5dbca', '#bdc5ae', '#8c977c', '#626d54', '#4f5942', '#3c4532', '#2b3223', '#1c2116', '#11150c']),
    dark: n('#1c211a', ['#131710', '#262d23', '#343c30', '#465041', '#7a8a72', '#9fae96', '#b9c6b1', '#cfd9c8', '#e3eadd', '#f3f7ef', '#fcfff9']),
    accents: { emerald: [145, 34], red: [10, 44], blue: [205, 36], amber: [40, 52] },
  },
};

export function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Lightness per step (light mode: dark text steps, pale tints) and the saturation each step keeps
const LIGHT_L: Record<Step, number> = { 50: 95.5, 100: 91, 200: 84, 300: 75, 400: 64, 500: 45, 600: 38, 700: 31, 800: 25, 900: 20, 950: 13 };
const LIGHT_S: Record<Step, number> = { 50: 0.55, 100: 0.65, 200: 0.75, 300: 0.85, 400: 0.95, 500: 1, 600: 1, 700: 1, 800: 1, 900: 1, 950: 1 };
const DARK_L: Record<Step, number> = { 50: 11, 100: 15, 200: 22, 300: 30, 400: 42, 500: 62, 600: 70, 700: 78, 800: 85, 900: 91, 950: 96 };
const DARK_S: Record<Step, number> = { 50: 0.6, 100: 0.65, 200: 0.7, 300: 0.75, 400: 0.8, 500: 0.95, 600: 0.95, 700: 0.9, 800: 0.85, 900: 0.8, 950: 0.7 };

/** A full 50-950 scale for one accent colour, with the text-like steps nudged until they read clearly. */
export function accentScale(hue: number, sat: number, mode: Mode, card: string): Record<Step, string> {
  const L = mode === 'light' ? LIGHT_L : DARK_L;
  const S = mode === 'light' ? LIGHT_S : DARK_S;
  const out = {} as Record<Step, string>;
  for (const step of STEPS) {
    let l = L[step];
    let hex = hslToHex(hue, sat * S[step], l);
    // text steps must read on the card colour: darker in light mode, lighter in dark mode
    const needed = step === 500 ? 4.5 : step >= 600 && step <= 900 ? 5 : 0;
    while (needed && contrast(hex, card) < needed && l > 4 && l < 96) {
      l += mode === 'light' ? -1 : 1;
      hex = hslToHex(hue, sat * S[step], l);
    }
    out[step] = hex;
  }
  return out;
}

const ACCENT_NAMES = ['emerald', 'red', 'blue', 'amber'] as const;

export function paletteVars(id: string, mode: Mode): Record<string, string> {
  const p = PALETTE_COLOURS[id];
  return p ? varsFor(p, mode) : {};
}

function varsFor(p: PaletteColours, mode: Mode): Record<string, string> {
  const neutrals = mode === 'light' ? p.light : p.dark;
  const vars: Record<string, string> = { '--color-white': neutrals.white };
  for (const s of STEPS) vars[`--color-neutral-${s}`] = neutrals.scale[s];
  for (const name of ACCENT_NAMES) {
    const [hue, sat] = p.accents[name];
    const scale = accentScale(hue, sat, mode, neutrals.white);
    for (const s of STEPS) vars[`--color-${name}-${s}`] = scale[s];
    // green is only used as a synonym of emerald
    if (name === 'emerald') for (const s of STEPS) vars[`--color-green-${s}`] = scale[s];
  }
  return vars;
}

/** The CSS for every palette. The default palette also applies before a choice has been made. */
export function paletteCss(): string {
  const block = (selector: string, vars: Record<string, string>, scheme: Mode) =>
    `${selector} {\n  color-scheme: ${scheme};\n${Object.entries(vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n')}\n}\n`;
  const parts: string[] = ['/* Generated by scripts/gen-palettes.ts from src/lib/palettes.ts. Do not edit by hand. */\n'];
  for (const p of PALETTES) {
    if (!PALETTE_COLOURS[p.id]) continue; // Classic uses Tailwind's own colours (its dark mode is in globals.css)
    const light = paletteVars(p.id, 'light');
    const dark = paletteVars(p.id, 'dark');
    const lightSel = p.id === DEFAULT_PALETTE ? `:root:not([data-palette]),\n:root[data-palette='${p.id}']` : `:root[data-palette='${p.id}']`;
    const darkSel = p.id === DEFAULT_PALETTE ? `:root.dark:not([data-palette]),\n:root.dark[data-palette='${p.id}']` : `:root.dark[data-palette='${p.id}']`;
    parts.push(block(lightSel, light, 'light'));
    parts.push(block(darkSel, dark, 'dark'));
  }
  return parts.join('\n');
}

/** Swatches shown in the appearance picker. */
export function paletteSwatches(id: string, mode: Mode, custom?: CustomTheme): { page: string; card: string; text: string; green: string; red: string; blue: string; amber: string } {
  const v = id === 'custom' ? customThemeVars(custom ?? DEFAULT_CUSTOM_THEME, mode) : paletteVars(id, mode);
  if (!Object.keys(v).length) {
    return mode === 'light'
      ? { page: '#fafafa', card: '#ffffff', text: '#171717', green: '#059669', red: '#dc2626', blue: '#2563eb', amber: '#d97706' }
      : { page: '#0a0a0a', card: '#171717', text: '#fafafa', green: '#6ee7b7', red: '#f87171', blue: '#93c5fd', amber: '#fbbf24' };
  }
  return {
    page: v['--color-neutral-50'],
    card: v['--color-white'],
    text: v['--color-neutral-900'],
    green: v['--color-emerald-600'],
    red: v['--color-red-600'],
    blue: v['--color-blue-600'],
    amber: v['--color-amber-600'],
  };
}

// ---------- custom palette ----------
/** The colours a person picks for their own palette (hex, like "#7a9e7e"). */
export interface CustomTheme {
  /** Colour of the page and panels: only its hue and a little of its strength are used, so they stay soft. */
  base: string;
  green: string;
  red: string;
  blue: string;
  amber: string;
}

export const DEFAULT_CUSTOM_THEME: CustomTheme = { base: '#d8c8a8', green: '#5f9c7d', red: '#b8574a', blue: '#5b86b0', amber: '#c08a2e' };

export function isCustomTheme(value: unknown): value is CustomTheme {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return ['base', 'green', 'red', 'blue', 'amber'].every((k) => typeof v[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(v[k] as string));
}

/** CSS variables for a custom palette, in the given mode. Text steps are always nudged to stay readable. */
export function customThemeVars(theme: CustomTheme, mode: Mode): Record<string, string> {
  const base = hexToHsl(theme.base);
  const accent = (hex: string): [number, number] => {
    const { h, s } = hexToHsl(hex);
    return [Math.round(h), Math.max(18, Math.min(70, Math.round(s)))];
  };
  const colours: PaletteColours = {
    light: generateNeutrals(base.h, base.s, 'light'),
    dark: generateNeutrals(base.h, base.s, 'dark'),
    accents: { emerald: accent(theme.green), red: accent(theme.red), blue: accent(theme.blue), amber: accent(theme.amber) },
  };
  return varsFor(colours, mode);
}