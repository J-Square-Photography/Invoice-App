'use client';

import { useEffect, useState } from 'react';
import { Check, Moon, Palette, RotateCcw, Sun, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DEFAULT_CUSTOM_THEME, PALETTES, paletteSwatches, type CustomTheme } from '@/lib/palettes';
import {
  CUSTOM_PALETTE_ID,
  FONT_OPTIONS,
  RADIUS_OPTIONS,
  SIZE_OPTIONS,
  getCustomTheme,
  getFont,
  getPalette,
  getRadius,
  getTextSize,
  isDarkMode,
  resetAppearance,
  saveCustomTheme,
  setDarkMode,
  setFont,
  setPalette,
  setRadius,
  setTextSize,
} from '@/lib/theme';

/** A small button that opens the appearance picker: light or dark, palette, your own colours, shape, text and font. */
export function AppearanceButton({ className, label }: { className?: string; label?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size={label ? 'sm' : 'icon'} onClick={() => setOpen(true)} title="Appearance" aria-label="Appearance" className={className}>
        <Palette className="h-4 w-4" />
        {label && <span className="ml-2">Appearance</span>}
      </Button>
      <AppearanceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

const COLOUR_FIELDS: Array<{ key: keyof CustomTheme; label: string; help: string }> = [
  { key: 'base', label: 'Background', help: 'Tints the page and panels' },
  { key: 'green', label: 'Green', help: 'Paid, success' },
  { key: 'red', label: 'Red', help: 'Overdue, delete' },
  { key: 'blue', label: 'Blue', help: 'Links, info' },
  { key: 'amber', label: 'Amber', help: 'Warnings, pending' },
];

/** A row of buttons that share the width they need instead of being forced into equal columns, so a
 * longer label (e.g. "Round") never gets clipped, even at a larger text size. */
function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ id: string; name: string; description: string }>;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            title={o.description}
            className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              value === o.id ? 'border-neutral-900 bg-neutral-100 text-neutral-900' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A small mock-up of the page (a card with two text bars and the four status colours), used both for
 * one half of a light/dark split preview and for the mode buttons. */
function MiniPage({ sw }: { sw: { page: string; card: string; text: string; green: string; red: string; blue: string; amber: string } }) {
  return (
    <div className="h-full p-2" style={{ backgroundColor: sw.page }}>
      <div className="rounded p-1.5 shadow-sm" style={{ backgroundColor: sw.card }}>
        <div className="mb-1 h-1.5 w-2/3 rounded" style={{ backgroundColor: sw.text }} />
        <div className="mb-1.5 h-1 w-1/2 rounded opacity-50" style={{ backgroundColor: sw.text }} />
        <div className="flex gap-1">
          {[sw.green, sw.red, sw.blue, sw.amber].map((c, i) => (
            <span key={i} className="h-2 flex-1 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** One preset card: light and dark shown side by side, so both are visible without touching the toggle.
 * For the Custom card this always reflects whatever colours are currently picked below. */
function PresetCard({
  id,
  name,
  description,
  custom,
  selected,
  onSelect,
}: {
  id: string;
  name: string;
  description: string;
  custom: CustomTheme;
  selected: boolean;
  onSelect: () => void;
}) {
  const light = paletteSwatches(id, 'light', custom);
  const dark = paletteSwatches(id, 'dark', custom);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`rounded-lg border p-2.5 text-left transition-colors ${selected ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200 hover:border-neutral-400'}`}
    >
      <div className="flex overflow-hidden rounded-md border border-black/10">
        <div className="w-1/2">
          <MiniPage sw={light} />
        </div>
        <div className="w-1/2 border-l border-black/10">
          <MiniPage sw={dark} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-sm font-semibold">
          {id === CUSTOM_PALETTE_ID && <Sparkles className="h-3.5 w-3.5" />}
          {name}
        </span>
        {selected && <Check className="h-4 w-4 shrink-0" />}
      </div>
      <p className="text-[11px] leading-snug text-neutral-500">{description}</p>
    </button>
  );
}

function AppearanceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [palette, setPaletteState] = useState('cozy');
  const [dark, setDark] = useState(false);
  const [custom, setCustom] = useState<CustomTheme>({ ...DEFAULT_CUSTOM_THEME });
  const [radius, setRadiusState] = useState('default');
  const [size, setSizeState] = useState('default');
  const [font, setFontState] = useState('default');

  const load = () => {
    setPaletteState(getPalette());
    setDark(isDarkMode());
    setCustom(getCustomTheme());
    setRadiusState(getRadius());
    setSizeState(getTextSize());
    setFontState(getFont());
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const choosePalette = (id: string) => {
    if (id === CUSTOM_PALETTE_ID) saveCustomTheme(custom);
    else setPalette(id);
    setPaletteState(id);
  };
  const chooseMode = (isDark: boolean) => {
    setDarkMode(isDark);
    setDark(isDark);
  };
  const changeColour = (key: keyof CustomTheme, hex: string) => {
    const next = { ...custom, [key]: hex };
    setCustom(next);
    saveCustomTheme(next); // applies live and switches to the custom palette
    setPaletteState(CUSTOM_PALETTE_ID);
  };
  const reset = () => {
    resetAppearance();
    setCustom({ ...DEFAULT_CUSTOM_THEME });
    load();
  };

  const cards = [...PALETTES, { id: CUSTOM_PALETTE_ID, name: 'Custom', description: 'Pick your own colours below' }];
  // The mode buttons are tinted with the palette actually in use, so which one is active is obvious at a glance
  const lightSwatch = paletteSwatches(palette, 'light', custom);
  const darkSwatch = paletteSwatches(palette, 'dark', custom);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Appearance</DialogTitle>
          <DialogDescription>Choose a ready-made look, or make your own. Changes apply straight away and are saved on this device.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Light or dark">
            {[
              { isDark: false, label: 'Light', icon: Sun, sw: lightSwatch },
              { isDark: true, label: 'Dark', icon: Moon, sw: darkSwatch },
            ].map(({ isDark, label, icon: Icon, sw }) => (
              <button
                key={label}
                type="button"
                aria-pressed={dark === isDark}
                onClick={() => chooseMode(isDark)}
                style={{ backgroundColor: sw.page, color: sw.text, borderColor: dark === isDark ? sw.blue : 'transparent' }}
                className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium shadow-sm transition-colors ${
                  dark === isDark ? '' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
                {dark === isDark && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Colour presets</p>
            <p className="text-xs text-neutral-500">Each card shows its light side (left) and dark side (right).</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cards.map((p) => (
                <PresetCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  description={p.description}
                  custom={custom}
                  selected={palette === p.id}
                  onSelect={() => choosePalette(p.id)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-neutral-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Sparkles className="h-4 w-4" /> Make your own colours
              </p>
              {palette !== CUSTOM_PALETTE_ID && <span className="text-xs text-neutral-500">Changing any colour switches to Custom</span>}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {COLOUR_FIELDS.map((f) => (
                <label key={f.key} className="flex flex-col items-start gap-1 text-xs">
                  <span className="font-medium">{f.label}</span>
                  <input
                    type="color"
                    value={custom[f.key]}
                    onChange={(e) => changeColour(f.key, e.target.value)}
                    aria-label={`${f.label} colour`}
                    className="h-9 w-full cursor-pointer rounded-md border border-neutral-200 bg-transparent p-0.5"
                  />
                  <span className="text-[11px] text-neutral-500">{f.help}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-neutral-500">
              Text is always kept readable: whatever colours you pick are softened and adjusted for both light and dark mode.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Segmented label="Corners" value={radius} options={RADIUS_OPTIONS} onChange={(id) => { setRadius(id); setRadiusState(id); }} />
            <Segmented label="Text size" value={size} options={SIZE_OPTIONS} onChange={(id) => { setTextSize(id); setSizeState(id); }} />
          </div>
          <Segmented label="Font" value={font} options={FONT_OPTIONS} onChange={(id) => { setFont(id); setFontState(id); }} />

          <div className="flex justify-end border-t border-neutral-200 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to default look
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
