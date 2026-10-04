export interface DiscountPreset {
  id: string;
  name: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  isCustom?: boolean;
}

export const DEFAULT_DISCOUNT_PRESETS: DiscountPreset[] = [
  { id: 'customer-loyalty-10', name: 'Customer Loyalty Discount', type: 'PERCENT', value: 10 },
  { id: 'non-profit-10', name: 'Non Profit Organisation', type: 'PERCENT', value: 10 },
  { id: 'discount-5', name: 'Discount', type: 'PERCENT', value: 5 },
  { id: 'discount-10', name: 'Discount', type: 'PERCENT', value: 10 },
  { id: 'discount-20', name: 'Discount', type: 'PERCENT', value: 20 },
];

export const DISCOUNT_PRESETS_STORAGE_KEY = 'jsquare_discount_presets';

/** Formats a preset into the standard client-facing option label: "Customer Loyalty Discount (10%)" or "Discount ($50)" */
export function formatPresetOptionLabel(preset: DiscountPreset): string {
  const symbol = preset.type === 'PERCENT' ? `${preset.value}%` : `$${preset.value}`;
  return `${preset.name} (${symbol})`;
}

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    return null;
  }
  return null;
}

/** Loads default presets combined with any custom presets saved in browser localStorage */
export function getDiscountPresets(): DiscountPreset[] {
  const storage = getStorage();
  if (!storage) return DEFAULT_DISCOUNT_PRESETS;
  try {
    const raw = storage.getItem(DISCOUNT_PRESETS_STORAGE_KEY);
    if (!raw) return DEFAULT_DISCOUNT_PRESETS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_DISCOUNT_PRESETS;
    const custom: DiscountPreset[] = parsed.filter(
      (p): p is DiscountPreset =>
        !!p &&
        typeof p.id === 'string' &&
        typeof p.name === 'string' &&
        (p.type === 'PERCENT' || p.type === 'FLAT') &&
        typeof p.value === 'number'
    );
    const customIds = new Set(custom.map((c) => c.id));
    return [...DEFAULT_DISCOUNT_PRESETS.filter((d) => !customIds.has(d.id)), ...custom];
  } catch {
    return DEFAULT_DISCOUNT_PRESETS;
  }
}

/** Saves a new custom discount preset to localStorage */
export function saveCustomDiscountPreset(preset: Omit<DiscountPreset, 'id' | 'isCustom'>): DiscountPreset {
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newPreset: DiscountPreset = {
    id,
    name: preset.name.trim(),
    type: preset.type,
    value: Number(preset.value),
    isCustom: true,
  };
  const storage = getStorage();
  if (storage) {
    try {
      const raw = storage.getItem(DISCOUNT_PRESETS_STORAGE_KEY);
      const existing: DiscountPreset[] = raw ? JSON.parse(raw) : [];
      const updated = [...existing.filter((p) => p.id !== id), newPreset];
      storage.setItem(DISCOUNT_PRESETS_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save custom discount preset to localStorage', err);
    }
  }
  return newPreset;
}

/** Deletes a custom discount preset from localStorage */
export function deleteCustomDiscountPreset(id: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(DISCOUNT_PRESETS_STORAGE_KEY);
    if (!raw) return;
    const existing: DiscountPreset[] = JSON.parse(raw);
    const updated = existing.filter((p) => p.id !== id);
    storage.setItem(DISCOUNT_PRESETS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to delete custom discount preset from localStorage', err);
  }
}
