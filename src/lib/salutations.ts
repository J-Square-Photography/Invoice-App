/**
 * A short list of common honorifics. Deliberately not exhaustive: the client form always offers
 * an "Other" option with free text next to it, because a wrong forced pick (e.g. defaulting
 * someone to "Mr"/"Mrs" when neither fits, or omitting "Mdm", "Ustaz", "Datuk", "Rev", a military
 * or religious title, and so on) is worse than an open box. Never assume a title from a name.
 */
export const SALUTATIONS = ['Mr', 'Mrs', 'Mdm', 'Ms', 'Miss', 'Dr', 'Prof', 'Mx'] as const;

export const isPresetSalutation = (value: string): boolean => (SALUTATIONS as readonly string[]).includes(value);
