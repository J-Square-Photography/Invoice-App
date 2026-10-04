import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_DISCOUNT_PRESETS,
  getDiscountPresets,
  saveCustomDiscountPreset,
  deleteCustomDiscountPreset,
  formatPresetOptionLabel,
  DISCOUNT_PRESETS_STORAGE_KEY,
} from '../discount-presets';
import { discountName, describeDiscount } from '../invoice-calculations';

describe('discount presets', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  it('contains the required default presets', () => {
    const labels = DEFAULT_DISCOUNT_PRESETS.map(formatPresetOptionLabel);
    expect(labels).toContain('Customer Loyalty Discount (10%)');
    expect(labels).toContain('Non Profit Organisation (10%)');
    expect(labels).toContain('Discount (5%)');
    expect(labels).toContain('Discount (10%)');
    expect(labels).toContain('Discount (20%)');
  });

  it('formats percentage and flat presets correctly', () => {
    expect(formatPresetOptionLabel({ id: '1', name: 'Student', type: 'PERCENT', value: 15 })).toBe('Student (15%)');
    expect(formatPresetOptionLabel({ id: '2', name: 'Partner', type: 'FLAT', value: 50 })).toBe('Partner ($50)');
  });

  it('saves and retrieves custom presets from localStorage', () => {
    const mockStorage: Record<string, string> = {};
    const originalLocalStorage = global.localStorage;
    global.localStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        for (const k in mockStorage) delete mockStorage[k];
      },
      length: 0,
      key: () => null,
    };

    try {
      const custom = saveCustomDiscountPreset({
        name: 'Friend & Family',
        type: 'PERCENT',
        value: 12,
      });
      expect(custom.id).toContain('custom-');
      expect(custom.name).toBe('Friend & Family');
      expect(custom.value).toBe(12);

      const presets = getDiscountPresets();
      expect(presets.some((p) => p.name === 'Friend & Family')).toBe(true);

      deleteCustomDiscountPreset(custom.id);
      const afterDelete = getDiscountPresets();
      expect(afterDelete.some((p) => p.name === 'Friend & Family')).toBe(false);
    } finally {
      global.localStorage = originalLocalStorage;
    }
  });
});

describe('discount name cleaning and description', () => {
  it('cleans redundant percentage or off in parentheses from the discount name', () => {
    expect(discountName({ name: 'Customer Loyalty Discount (10%)' })).toBe('Customer Loyalty Discount');
    expect(discountName({ name: 'Customer Loyalty DIscount (10% off)' })).toBe('Customer Loyalty DIscount');
    expect(discountName({ name: 'Non Profit Organisation (10%)' })).toBe('Non Profit Organisation');
    expect(discountName({ name: 'Discount ($50)' })).toBe('Discount');
  });

  it('produces clean client-facing discount descriptions without duplicated terms', () => {
    expect(
      describeDiscount({
        name: 'Customer Loyalty Discount (10%)',
        type: 'PERCENT',
        value: 10,
      })
    ).toBe('Customer Loyalty Discount (10% off)');

    expect(
      describeDiscount({
        name: 'Customer Loyalty DIscount',
        type: 'PERCENT',
        value: 10,
      })
    ).toBe('Customer Loyalty DIscount (10% off)');
  });
});
