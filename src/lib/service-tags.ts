import { PROJECT_TYPE_LABELS } from './constants';

/**
 * The services a project can involve. A project can carry several (e.g. photography
 * plus videography plus photobooth). The ids match the service catalogue in
 * service-presets.ts, so a project's tags decide which price presets its invoices offer.
 * 'other' has no presets: those lines are typed in by hand.
 */
export interface ServiceTag {
  id: string;
  label: string;
}

export const SERVICE_TAGS: ServiceTag[] = [
  { id: 'event-photography', label: 'Event Photography' },
  { id: 'event-videography', label: 'Event Videography' },
  { id: 'dslr-photobooth', label: 'DSLR Photobooth' },
  { id: 'food-photography', label: 'Food Photography' },
  { id: 'wedding-photography-videography', label: 'Wedding Photo & Video' },
  { id: 'corporate-photography', label: 'Corporate Photography' },
  { id: 'film-production', label: 'Film Production' },
  { id: 'other', label: 'Other' },
];

const TAG_IDS = new Set(SERVICE_TAGS.map((t) => t.id));

export const isServiceTag = (id: unknown): id is string => typeof id === 'string' && TAG_IDS.has(id);

export function tagLabel(id: string): string {
  return SERVICE_TAGS.find((t) => t.id === id)?.label ?? id;
}

/** Keeps only valid tags, without duplicates, in a stable order. */
export function cleanTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const wanted = new Set(input.filter(isServiceTag));
  return SERVICE_TAGS.filter((t) => wanted.has(t.id)).map((t) => t.id);
}

/** The older single "project type" kept in step with the first tag so existing screens still work. */
const LEGACY_TYPE: Record<string, string> = {
  'event-photography': 'EVENT',
  'event-videography': 'COMMERCIAL_VIDEO',
  'dslr-photobooth': 'PHOTOBOOTH',
  'food-photography': 'OTHER',
  'wedding-photography-videography': 'EVENT',
  'corporate-photography': 'PORTRAIT',
  'film-production': 'COMMERCIAL_VIDEO',
  other: 'OTHER',
};

export function legacyTypeForTags(tags: string[]): string {
  return tags.length > 0 ? LEGACY_TYPE[tags[0]] ?? 'OTHER' : 'OTHER';
}

/**
 * What to show for a project: its tags, or, for older projects created before tags
 * existed, its old single type as one label.
 */
export function displayTags(tags: string[] | null | undefined, legacyType?: string | null): string[] {
  if (tags && tags.length > 0) return tags.map(tagLabel);
  return legacyType ? [PROJECT_TYPE_LABELS[legacyType] || legacyType] : [];
}
