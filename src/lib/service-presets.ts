import { PHOTOBOOTH_PACKAGES, PHOTOBOOTH_CATEGORIES } from './photobooth-presets';

/**
 * Services and prices offered when creating an invoice, so line items can be picked
 * instead of typed. Event photography, event videography and food photography come
 * from https://jsquarephotography.com (checked September 2026). Photobooth keeps the
 * prices already in this app (the website's photobooth pricing has not been updated).
 * Services the website lists as "custom quote" have no price here: the price is
 * entered on the invoice.
 */

export interface ServiceItem {
  id: string;
  /** Text shown in the dropdown. */
  label: string;
  /** Short name used in confirmations. */
  name: string;
  /** Becomes the invoice line item description. */
  description: string;
  price: number;
}

export interface ServiceGroup {
  label: string;
  items: ServiceItem[];
}

export interface ServiceCatalogueEntry {
  id: string;
  name: string;
  /** Shown beside the service name in the dropdown, e.g. "from $150/hr". */
  hint: string;
  groups: ServiceGroup[];
}

const HOURS = [1, 2, 3, 4, 5, 6, 7];

/** Price per duration (1 to 7 hours), by tier, exactly as listed on the website. */
type TierPrices = Record<string, number[]>;

export const EVENT_PHOTOGRAPHY_PRICES: TierPrices = {
  'Beginner (Student)': [30, 60, 90, 120, 150, 180, 210],
  Novice: [60, 120, 180, 240, 300, 360, 420],
  Enthusiast: [150, 300, 400, 500, 600, 700, 800],
  Professional: [200, 400, 600, 800, 1000, 1200, 1400],
  Director: [250, 500, 750, 1000, 1250, 1500, 1750],
};

export const EVENT_VIDEOGRAPHY_PRICES: TierPrices = {
  'Beginner (Student)': [60, 120, 180, 240, 300, 360, 420],
  Novice: [100, 200, 300, 400, 500, 600, 700],
  Enthusiast: [200, 400, 600, 800, 1000, 1200, 1400],
  Professional: [300, 600, 900, 1200, 1500, 1800, 2100],
  Director: [400, 800, 1200, 1600, 2000, 2400, 2800],
};

const hoursLabel = (h: number) => `${h} ${h === 1 ? 'hour' : 'hours'}`;
const money = (n: number) => `SGD $${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function tieredService(id: string, name: string, hint: string, prices: TierPrices): ServiceCatalogueEntry {
  return {
    id,
    name,
    hint,
    groups: Object.entries(prices).map(([tier, byHour]) => {
      const tierLabel = tier === 'Enthusiast' ? 'Enthusiast (Recommended)' : tier;
      return {
        label: tierLabel,
        items: HOURS.map((h, i) => ({
          id: `${id}-${slug(tier)}-${h}h`,
          label: `${hoursLabel(h)} — ${money(byHour[i])}`,
          name: `${name}, ${tier.replace(/ \(.*\)/, '')} ${h}h`,
          description: `${name} (${tier}, ${hoursLabel(h)})`,
          price: byHour[i],
        })),
      };
    }),
  };
}

/** A service the website lists without a price: the invoice line starts at 0 for you to fill in. */
function customQuoteService(id: string, name: string, detail: string): ServiceCatalogueEntry {
  return {
    id,
    name,
    hint: 'custom quote',
    groups: [
      {
        label: 'Custom quote',
        items: [
          {
            id: `${id}-custom`,
            label: `${name}: enter the quoted price`,
            name: `${name} (custom)`,
            description: `${name} (${detail})`,
            price: 0,
          },
        ],
      },
    ],
  };
}

const photoboothService: ServiceCatalogueEntry = {
  id: 'dslr-photobooth',
  name: 'DSLR Photobooth',
  hint: 'from $368',
  groups: PHOTOBOOTH_CATEGORIES.map((category) => ({
    label: category,
    items: PHOTOBOOTH_PACKAGES.filter((p) => p.category === category).map((p) => ({
      id: p.id,
      label: `${p.name} — ${money(p.price)}`,
      name: p.name,
      description: p.description,
      price: p.price,
    })),
  })),
};

export const SERVICE_CATALOGUE: ServiceCatalogueEntry[] = [
  tieredService('event-photography', 'Event Photography', 'from $150/hr', EVENT_PHOTOGRAPHY_PRICES),
  tieredService('event-videography', 'Event Videography', 'from $200/hr', EVENT_VIDEOGRAPHY_PRICES),
  photoboothService,
  {
    id: 'food-photography',
    name: 'Food Photography',
    hint: 'from $400',
    groups: [
      {
        label: 'Food Photography',
        items: [
          {
            id: 'food-photography-from',
            label: `Food Photography, starting rate — ${money(400)}`,
            name: 'Food Photography (from $400)',
            description: 'Food Photography (starting rate; includes styling guidance, multiple angles, edited high-resolution images)',
            price: 400,
          },
        ],
      },
    ],
  },
  customQuoteService(
    'wedding-photography-videography',
    'Wedding Photography & Videography',
    'custom package: full-day coverage up to 10 hours, two photographers and a videographer, highlight film, engagement shoot'
  ),
  customQuoteService(
    'corporate-photography',
    'Corporate Photography',
    'custom package: headshots, corporate events, office and facility photography'
  ),
  customQuoteService(
    'film-production',
    'Film Production',
    'custom package: end-to-end production, editing, colour grading and sound design'
  ),
];

const ALL_ITEMS: ServiceItem[] = SERVICE_CATALOGUE.flatMap((s) => s.groups.flatMap((g) => g.items));

export function findServiceItem(id: string): ServiceItem | undefined {
  return ALL_ITEMS.find((item) => item.id === id);
}
