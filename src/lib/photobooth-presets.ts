export interface PhotoboothPackage {
  id: string;
  name: string;
  shortLabel: string;
  category: '2 Hours' | '3 Hours' | '4 Hours' | 'Add-ons';
  durationHours: number;
  packageType: 'Package A' | 'Package B' | 'Package C' | 'Add-on';
  price: number;
  description: string;
  /** "What's included" bullets for the invoice line (one per line), or undefined for add-ons. */
  details?: string;
}

/**
 * What every photobooth package includes, in the order shown on the invoice. `only` limits a
 * bullet to the packages that include it. Package C is digital only, so it has none of the printing
 * bullets.
 */
const WITH_PRINTS: PhotoboothPackage['packageType'][] = ['Package A', 'Package B'];

export const PHOTOBOOTH_INCLUSIONS: Array<{ text: string; only?: PhotoboothPackage['packageType'][] }> = [
  { text: 'Professional DSLR camera with studio lighting' },
  { text: 'Industry standard printer with high-quality, fast printing', only: WITH_PRINTS },
  { text: 'Unlimited prints', only: WITH_PRINTS },
  { text: 'Range of backdrops for your selection' },
  { text: 'Complimentary props provided' },
  { text: 'Customised graphic designs for photo frame templates' },
  { text: 'Print format: choice of Strips or 4R', only: WITH_PRINTS },
  { text: 'Professional media crew on-site', only: ['Package A'] },
  { text: 'LCD panel display customisation', only: ['Package A'] },
];

/** The "What's included" text for a package (one bullet per line); empty for add-ons. */
export function photoboothInclusions(packageType: PhotoboothPackage['packageType']): string {
  if (packageType === 'Add-on') return '';
  return PHOTOBOOTH_INCLUSIONS.filter((i) => !i.only || i.only.includes(packageType))
    .map((i) => i.text)
    .join('\n');
}

const PACKAGES: PhotoboothPackage[] = [
  // --- 2 HOURS EVENT ---
  {
    id: 'pb-2h-a',
    name: '2 Hours Event - Package A',
    shortLabel: '2h Pkg A ($538)',
    category: '2 Hours',
    durationHours: 2,
    packageType: 'Package A',
    price: 538,
    description: 'Photobooth - 2 Hours Event (Package A: Full Crew, Setup & Unlimited Instant Prints)',
  },
  {
    id: 'pb-2h-b',
    name: '2 Hours Event - Package B',
    shortLabel: '2h Pkg B ($468)',
    category: '2 Hours',
    durationHours: 2,
    packageType: 'Package B',
    price: 468,
    description: 'Photobooth - 2 Hours Event (Package B: Setup & Unlimited Prints, Self-Service)',
  },
  {
    id: 'pb-2h-c',
    name: '2 Hours Event - Package C',
    shortLabel: '2h Pkg C ($368)',
    category: '2 Hours',
    durationHours: 2,
    packageType: 'Package C',
    price: 368,
    description: 'Photobooth - 2 Hours Event (Package C: Digital Only, Setup, No Prints, Self-Service)',
  },

  // --- 3 HOURS EVENT ---
  {
    id: 'pb-3h-a',
    name: '3 Hours Event - Package A',
    shortLabel: '3h Pkg A ($638)',
    category: '3 Hours',
    durationHours: 3,
    packageType: 'Package A',
    price: 638,
    description: 'Photobooth - 3 Hours Event (Package A: Full Crew, Setup & Unlimited Instant Prints)',
  },
  {
    id: 'pb-3h-b',
    name: '3 Hours Event - Package B',
    shortLabel: '3h Pkg B ($568)',
    category: '3 Hours',
    durationHours: 3,
    packageType: 'Package B',
    price: 568,
    description: 'Photobooth - 3 Hours Event (Package B: Setup & Unlimited Prints, Self-Service)',
  },
  {
    id: 'pb-3h-c',
    name: '3 Hours Event - Package C',
    shortLabel: '3h Pkg C ($468)',
    category: '3 Hours',
    durationHours: 3,
    packageType: 'Package C',
    price: 468,
    description: 'Photobooth - 3 Hours Event (Package C: Digital Only, Setup, No Prints, Self-Service)',
  },

  // --- 4 HOURS EVENT ---
  {
    id: 'pb-4h-a',
    name: '4 Hours Event - Package A',
    shortLabel: '4h Pkg A ($738)',
    category: '4 Hours',
    durationHours: 4,
    packageType: 'Package A',
    price: 738,
    description: 'Photobooth - 4 Hours Event (Package A: Full Crew, Setup & Unlimited Instant Prints)',
  },
  {
    id: 'pb-4h-b',
    name: '4 Hours Event - Package B',
    shortLabel: '4h Pkg B ($668)',
    category: '4 Hours',
    durationHours: 4,
    packageType: 'Package B',
    price: 668,
    description: 'Photobooth - 4 Hours Event (Package B: Setup & Unlimited Prints, Self-Service)',
  },
  {
    id: 'pb-4h-c',
    name: '4 Hours Event - Package C',
    shortLabel: '4h Pkg C ($518)',
    category: '4 Hours',
    durationHours: 4,
    packageType: 'Package C',
    price: 518,
    description: 'Photobooth - 4 Hours Event (Package C: Digital Only, Setup, No Prints, Self-Service)',
  },

  // --- POPULAR ADD-ONS ---
  {
    id: 'pb-addon-extra-hour',
    name: 'Additional 1 Hour Extension',
    shortLabel: '+1h Ext ($100)',
    category: 'Add-ons',
    durationHours: 1,
    packageType: 'Add-on',
    price: 100,
    description: 'Photobooth Extension - Additional 1 Hour Operating Time',
  },
  {
    id: 'pb-addon-backdrop',
    name: 'Custom Backdrop Setup',
    shortLabel: 'Backdrop ($60)',
    category: 'Add-ons',
    durationHours: 0,
    packageType: 'Add-on',
    price: 60,
    description: 'Photobooth - Custom Themed Backdrop Setup & Teardown',
  },
  {
    id: 'pb-addon-design',
    name: 'Customized Print Border Design',
    shortLabel: 'Design ($25)',
    category: 'Add-ons',
    durationHours: 0,
    packageType: 'Add-on',
    price: 25,
    description: 'Photobooth - Custom Graphic Design for Photo Print Borders & Overlays',
  },
  {
    id: 'pb-addon-prints',
    name: 'Unlimited Instant Prints Upgrade',
    shortLabel: 'Prints ($88)',
    category: 'Add-ons',
    durationHours: 0,
    packageType: 'Add-on',
    price: 88,
    description: 'Photobooth - Unlimited Instant 4R / 2R Photo Prints Add-On',
  },
];

export const PHOTOBOOTH_PACKAGES: PhotoboothPackage[] = PACKAGES.map((p) => {
  const details = photoboothInclusions(p.packageType);
  return details ? { ...p, details } : p;
});

export const PHOTOBOOTH_CATEGORIES = [
  '2 Hours',
  '3 Hours',
  '4 Hours',
  'Add-ons',
] as const;

export function getPresetById(id: string): PhotoboothPackage | undefined {
  return PHOTOBOOTH_PACKAGES.find((p) => p.id === id);
}
