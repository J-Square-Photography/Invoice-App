import { DEFAULT_CUSTOM_THEME, DEFAULT_PALETTE, PALETTES, customThemeVars, isCustomTheme, type CustomTheme } from '@/lib/palettes';

export const THEME_STORAGE_KEY = 'jsquare-theme';
export const PALETTE_STORAGE_KEY = 'jsquare-palette';
/** The person's own colours, as JSON ({ base, green, red, blue, amber }). */
export const CUSTOM_STORAGE_KEY = 'jsquare-custom-theme';
/** The custom palette worked out for light and dark, so it can be applied before first paint. */
export const CUSTOM_VARS_KEY = 'jsquare-custom-vars';
export const RADIUS_STORAGE_KEY = 'jsquare-radius';
export const SIZE_STORAGE_KEY = 'jsquare-size';
export const FONT_STORAGE_KEY = 'jsquare-font';

export const CUSTOM_PALETTE_ID = 'custom';

export const RADIUS_OPTIONS = [
  { id: 'sharp', name: 'Sharp', description: 'Square, crisp corners' },
  { id: 'default', name: 'Soft', description: 'Slightly rounded (default)' },
  { id: 'round', name: 'Round', description: 'Friendly, very rounded' },
] as const;

export const SIZE_OPTIONS = [
  { id: 'compact', name: 'Compact', description: 'Smaller text, more on screen' },
  { id: 'default', name: 'Normal', description: 'The default size' },
  { id: 'large', name: 'Large', description: 'Bigger text, easier to read' },
] as const;

export const FONT_OPTIONS = [
  { id: 'default', name: 'Inter', description: 'Clean and modern (default)' },
  { id: 'system', name: 'System', description: 'Your device’s own font' },
  { id: 'serif', name: 'Serif', description: 'Classic, editorial' },
  { id: 'rounded', name: 'Rounded', description: 'Soft and friendly' },
] as const;

const PALETTE_IDS = [...PALETTES.map((p) => p.id), CUSTOM_PALETTE_ID];
const pick = <T extends { id: string }>(options: readonly T[], value: string | null): string =>
  options.some((o) => o.id === value) ? (value as string) : 'default';

/**
 * Runs before first paint (inlined in the root layout) so the saved mode, palette, shape, text size and
 * font are applied without a flash of the wrong look.
 */
export const themeInitScript = `try{var d=document.documentElement,s=localStorage,g=function(k){return s.getItem(k)};var p=g('${PALETTE_STORAGE_KEY}');var ok=${JSON.stringify(PALETTE_IDS)};p=ok.indexOf(p)>=0?p:'${DEFAULT_PALETTE}';d.setAttribute('data-palette',p);var dark=g('${THEME_STORAGE_KEY}')==='dark';if(dark){d.classList.add('dark')}var pk=function(k,a){var v=g(k);return a.indexOf(v)>=0?v:'default'};d.setAttribute('data-radius',pk('${RADIUS_STORAGE_KEY}',${JSON.stringify(RADIUS_OPTIONS.map((o) => o.id))}));d.setAttribute('data-size',pk('${SIZE_STORAGE_KEY}',${JSON.stringify(SIZE_OPTIONS.map((o) => o.id))}));d.setAttribute('data-font',pk('${FONT_STORAGE_KEY}',${JSON.stringify(FONT_OPTIONS.map((o) => o.id))}));if(p==='${CUSTOM_PALETTE_ID}'){var c=JSON.parse(g('${CUSTOM_VARS_KEY}')||'null');if(c){var v=c[dark?'dark':'light'];for(var k in v){d.style.setProperty(k,v[k])}d.style.colorScheme=dark?'dark':'light'}}}catch(e){}`;

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); the choice still applies for this visit.
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// ---------- light / dark ----------
export function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function setDarkMode(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
  store(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
  applyCustomVariables();
}

/** Toggles dark mode on <html> and remembers the choice in this browser. */
export function toggleTheme(): void {
  setDarkMode(!isDarkMode());
}

// ---------- palettes ----------
export function getPalette(): string {
  const current = document.documentElement.getAttribute('data-palette');
  return current && PALETTE_IDS.includes(current) ? current : DEFAULT_PALETTE;
}

/** Switches the colour palette (a preset, or "custom") and remembers it in this browser. */
export function setPalette(id: string): void {
  if (!PALETTE_IDS.includes(id)) return;
  document.documentElement.setAttribute('data-palette', id);
  store(PALETTE_STORAGE_KEY, id);
  applyCustomVariables();
}

// ---------- custom colours ----------
let appliedCustomKeys: string[] = [];

/** Puts the custom palette's colours on <html> (or takes them off when another palette is chosen). */
export function applyCustomVariables(): void {
  const root = document.documentElement;
  for (const k of appliedCustomKeys) root.style.removeProperty(k);
  appliedCustomKeys = [];
  root.style.removeProperty('color-scheme');
  if (getPalette() !== CUSTOM_PALETTE_ID) return;

  const theme = getCustomTheme();
  const mode = isDarkMode() ? 'dark' : 'light';
  const vars = customThemeVars(theme, mode);
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
    appliedCustomKeys.push(k);
  }
  root.style.colorScheme = mode;
}

export function getCustomTheme(): CustomTheme {
  try {
    const parsed = JSON.parse(read(CUSTOM_STORAGE_KEY) ?? 'null');
    if (isCustomTheme(parsed)) return parsed;
  } catch {
    // fall through to the default
  }
  return { ...DEFAULT_CUSTOM_THEME };
}

/** Saves the person's own colours, switches to the custom palette and applies them straight away. */
export function saveCustomTheme(theme: CustomTheme): void {
  store(CUSTOM_STORAGE_KEY, JSON.stringify(theme));
  // pre-computed for both modes, so the next page load can apply them before first paint
  store(CUSTOM_VARS_KEY, JSON.stringify({ light: customThemeVars(theme, 'light'), dark: customThemeVars(theme, 'dark') }));
  setPalette(CUSTOM_PALETTE_ID);
}

// ---------- shape, text size, font ----------
function attributeChoice(attr: string, key: string, options: readonly { id: string }[]) {
  return {
    get: () => pick(options, document.documentElement.getAttribute(attr)),
    set: (id: string) => {
      const value = pick(options, id);
      document.documentElement.setAttribute(attr, value);
      store(key, value);
    },
  };
}

const radius = attributeChoice('data-radius', RADIUS_STORAGE_KEY, RADIUS_OPTIONS);
const size = attributeChoice('data-size', SIZE_STORAGE_KEY, SIZE_OPTIONS);
const font = attributeChoice('data-font', FONT_STORAGE_KEY, FONT_OPTIONS);
export const getRadius = radius.get;
export const setRadius = radius.set;
export const getTextSize = size.get;
export const setTextSize = size.set;
export const getFont = font.get;
export const setFont = font.set;

/** Puts everything back to the default look: Cozy, light, soft corners, normal text, Inter. */
export function resetAppearance(): void {
  setDarkMode(false);
  setPalette(DEFAULT_PALETTE);
  setRadius('default');
  setTextSize('default');
  setFont('default');
}
