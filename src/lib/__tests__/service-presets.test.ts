import { describe, it, expect } from 'vitest';
import {
  SERVICE_CATALOGUE,
  EVENT_PHOTOGRAPHY_PRICES,
  EVENT_VIDEOGRAPHY_PRICES,
  findServiceItem,
} from '../service-presets';
import { PHOTOBOOTH_PACKAGES } from '../photobooth-presets';

const allItems = SERVICE_CATALOGUE.flatMap((s) => s.groups.flatMap((g) => g.items));

describe('service presets', () => {
  it('every tier has a price for each of 1 to 7 hours', () => {
    for (const table of [EVENT_PHOTOGRAPHY_PRICES, EVENT_VIDEOGRAPHY_PRICES]) {
      expect(Object.keys(table)).toHaveLength(5);
      for (const prices of Object.values(table)) expect(prices).toHaveLength(7);
    }
  });

  it('matches the published website prices (spot checks)', () => {
    expect(findServiceItem('event-photography-enthusiast-1h')?.price).toBe(150);
    expect(findServiceItem('event-photography-enthusiast-3h')?.price).toBe(400);
    expect(findServiceItem('event-photography-director-7h')?.price).toBe(1750);
    expect(findServiceItem('event-photography-beginner-student-1h')?.price).toBe(30);
    expect(findServiceItem('event-videography-enthusiast-1h')?.price).toBe(200);
    expect(findServiceItem('event-videography-novice-4h')?.price).toBe(400);
    expect(findServiceItem('event-videography-director-7h')?.price).toBe(2800);
    expect(findServiceItem('food-photography-from')?.price).toBe(400);
  });

  it('services with no published price start at zero rather than an invented number', () => {
    for (const id of ['wedding-photography-videography-custom', 'corporate-photography-custom', 'film-production-custom']) {
      expect(findServiceItem(id)?.price).toBe(0);
    }
  });

  it('photobooth keeps the prices already in the app', () => {
    for (const p of PHOTOBOOTH_PACKAGES) {
      expect(findServiceItem(p.id)?.price).toBe(p.price);
    }
  });

  it('every item id is unique and has a description', () => {
    const ids = allItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of allItems) expect(item.description.length).toBeGreaterThan(5);
  });
});

describe("photobooth What's included", () => {
  const detailsOf = (id: string) => PHOTOBOOTH_PACKAGES.find((p) => p.id === id)?.details?.split('\n') ?? [];

  it('Package A includes everything, including crew and LCD panel', () => {
    const a = detailsOf('pb-2h-a');
    expect(a).toHaveLength(9);
    expect(a).toContain('Unlimited prints');
    expect(a).toContain('Professional media crew on-site');
    expect(a).toContain('LCD panel display customisation');
  });

  it('Package B has unlimited prints but no crew or LCD panel', () => {
    const b = detailsOf('pb-3h-b');
    expect(b).toContain('Unlimited prints');
    expect(b).not.toContain('Professional media crew on-site');
    expect(b).not.toContain('LCD panel display customisation');
  });

  it('Package C is digital only: no printer, prints or print formats, and no crew or LCD panel', () => {
    const c = detailsOf('pb-4h-c');
    expect(c).toEqual([
      'Professional DSLR camera with studio lighting',
      'Range of backdrops for your selection',
      'Complimentary props provided',
      'Customised graphic designs for photo frame templates',
    ]);
  });

  it('every description matches its package: A has crew and prints, B prints but no crew, C digital only with no crew', () => {
    const wording: Record<string, string> = {
      'Package A': 'Package A: Full Crew, Setup & Unlimited Instant Prints',
      'Package B': 'Package B: Setup & Unlimited Prints, Self-Service',
      'Package C': 'Package C: Digital Only, Setup, No Prints, Self-Service',
    };
    for (const p of PHOTOBOOTH_PACKAGES.filter((p) => p.packageType !== 'Add-on')) {
      expect(p.description).toContain(wording[p.packageType]);
    }
  });

  it('add-ons carry no inclusions, and the service dropdown passes package details through', () => {
    expect(PHOTOBOOTH_PACKAGES.find((p) => p.id === 'pb-addon-extra-hour')?.details).toBeUndefined();
    expect(findServiceItem('pb-2h-a')?.details).toBe(PHOTOBOOTH_PACKAGES.find((p) => p.id === 'pb-2h-a')?.details);
  });
});
