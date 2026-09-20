export interface PhotoboothPackage {
  id: string;
  name: string;
  shortLabel: string;
  category: '2 Hours' | '3 Hours' | '4 Hours' | 'Add-ons';
  durationHours: number;
  packageType: 'Package A' | 'Package B' | 'Package C' | 'Add-on';
  price: number;
  description: string;
  features: string[];
}

export const PHOTOBOOTH_PACKAGES: PhotoboothPackage[] = [
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
    features: [
      '2 Hours live operating time',
      'Full crew (Main Operator + Assistant)',
      'Setup & teardown included',
      'Unlimited high-speed instant 4R/2R prints',
      'Customized print border design',
      'Online digital gallery & instant QR download',
    ],
  },
  {
    id: 'pb-2h-b',
    name: '2 Hours Event - Package B',
    shortLabel: '2h Pkg B ($468)',
    category: '2 Hours',
    durationHours: 2,
    packageType: 'Package B',
    price: 468,
    description: 'Photobooth - 2 Hours Event (Package B: Setup & Unlimited Prints, Self-Service / No Crew)',
    features: [
      '2 Hours live operating time',
      'Automated setup & teardown included',
      'Unlimited high-speed instant prints',
      'Self-service booth (No on-site crew)',
      'Online digital gallery & instant QR download',
    ],
  },
  {
    id: 'pb-2h-c',
    name: '2 Hours Event - Package C',
    shortLabel: '2h Pkg C ($368)',
    category: '2 Hours',
    durationHours: 2,
    packageType: 'Package C',
    price: 368,
    description: 'Photobooth - 2 Hours Event (Package C: Digital Only, Setup, No Prints, No Crew)',
    features: [
      '2 Hours live operating time',
      'Digital soft copies only (Instant QR / AirDrop)',
      'Automated setup & teardown included',
      'No physical prints & No on-site crew',
      'Online digital gallery',
    ],
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
    features: [
      '3 Hours live operating time',
      'Full crew (Main Operator + Assistant)',
      'Setup & teardown included',
      'Unlimited high-speed instant 4R/2R prints',
      'Customized print border design',
      'Online digital gallery & instant QR download',
    ],
  },
  {
    id: 'pb-3h-b',
    name: '3 Hours Event - Package B',
    shortLabel: '3h Pkg B ($568)',
    category: '3 Hours',
    durationHours: 3,
    packageType: 'Package B',
    price: 568,
    description: 'Photobooth - 3 Hours Event (Package B: Setup & Unlimited Prints, No Crew)',
    features: [
      '3 Hours live operating time',
      'Automated setup & teardown included',
      'Unlimited high-speed instant prints',
      'Self-service booth (No on-site crew)',
      'Online digital gallery & instant QR download',
    ],
  },
  {
    id: 'pb-3h-c',
    name: '3 Hours Event - Package C',
    shortLabel: '3h Pkg C ($468)',
    category: '3 Hours',
    durationHours: 3,
    packageType: 'Package C',
    price: 468,
    description: 'Photobooth - 3 Hours Event (Package C: Digital Only with On-Site Crew)',
    features: [
      '3 Hours live operating time',
      'On-site operator assistance included',
      'Digital soft copies only (Instant QR / AirDrop)',
      'No physical prints',
      'Online digital gallery',
    ],
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
    features: [
      '4 Hours live operating time',
      'Full crew (Main Operator + Assistant)',
      'Setup & teardown included',
      'Unlimited high-speed instant 4R/2R prints',
      'Customized print border design',
      'Online digital gallery & instant QR download',
    ],
  },
  {
    id: 'pb-4h-b',
    name: '4 Hours Event - Package B',
    shortLabel: '4h Pkg B ($668)',
    category: '4 Hours',
    durationHours: 4,
    packageType: 'Package B',
    price: 668,
    description: 'Photobooth - 4 Hours Event (Package B: Setup & Unlimited Prints, No Crew)',
    features: [
      '4 Hours live operating time',
      'Automated setup & teardown included',
      'Unlimited high-speed instant prints',
      'Self-service booth (No on-site crew)',
      'Online digital gallery & instant QR download',
    ],
  },
  {
    id: 'pb-4h-c',
    name: '4 Hours Event - Package C',
    shortLabel: '4h Pkg C ($518)',
    category: '4 Hours',
    durationHours: 4,
    packageType: 'Package C',
    price: 518,
    description: 'Photobooth - 4 Hours Event (Package C: Digital Only with On-Site Crew)',
    features: [
      '4 Hours live operating time',
      'On-site operator assistance included',
      'Digital soft copies only (Instant QR / AirDrop)',
      'No physical prints',
      'Online digital gallery',
    ],
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
    features: ['1 additional hour of live photobooth operation and printing'],
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
    features: ['Physical studio backdrop frame and themed fabric/shimmer curtain'],
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
    features: ['Personalized event logo, typography, and theme styling for photo printouts'],
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
    features: ['High-speed thermal sub-dye photo printing with protective gloss coat'],
  },
];

export const PHOTOBOOTH_CATEGORIES = [
  '2 Hours',
  '3 Hours',
  '4 Hours',
  'Add-ons',
] as const;

export function getPresetById(id: string): PhotoboothPackage | undefined {
  return PHOTOBOOTH_PACKAGES.find((p) => p.id === id);
}
