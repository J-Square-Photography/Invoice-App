/** The studio's own skill-progression ladder, used to grade a staff member's training level in
 * each discipline (see SKILL_DISCIPLINES) - the same tier names already used for client-facing
 * service pricing (e.g. "Event Photography (Enthusiast, 3 hours)"). */
export const SKILL_LEVELS = ['Beginner', 'Novice', 'Enthusiast', 'Professional', 'Director'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export function isSkillLevel(value: string): value is SkillLevel {
  return (SKILL_LEVELS as readonly string[]).includes(value);
}

export const SKILL_DISCIPLINES = ['Photography', 'Videography'] as const;
export type SkillDiscipline = (typeof SKILL_DISCIPLINES)[number];

export function isSkillDiscipline(value: string): value is SkillDiscipline {
  return (SKILL_DISCIPLINES as readonly string[]).includes(value);
}

export interface StaffSkill {
  discipline: SkillDiscipline;
  level: SkillLevel;
}

/** Drops anything not shaped like { discipline, level } with recognised values, and de-duplicates
 * by discipline (a staff member has at most one level per discipline). */
export function sanitizeSkills(value: unknown): StaffSkill[] {
  if (!Array.isArray(value)) return [];
  const byDiscipline = new Map<SkillDiscipline, SkillLevel>();
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const discipline = (row as { discipline?: unknown }).discipline;
    const level = (row as { level?: unknown }).level;
    if (typeof discipline === 'string' && isSkillDiscipline(discipline) && typeof level === 'string' && isSkillLevel(level)) {
      byDiscipline.set(discipline, level);
    }
  }
  return SKILL_DISCIPLINES.filter((d) => byDiscipline.has(d)).map((discipline) => ({ discipline, level: byDiscipline.get(discipline)! }));
}

/** A tag on one admin-defined skill category (see the SkillCategory model), e.g. { categoryId:
 * "...", value: "Main" } for a Photobooth category - informational only, no pay meaning. */
export interface ExtraSkillTag {
  categoryId: string;
  value: string;
}

/** Drops anything not shaped like { categoryId, value }, and anything whose category no longer
 * exists or whose value isn't one of that category's current options; de-duplicates by category. */
export function sanitizeExtraSkills(value: unknown, categories: Array<{ id: string; options: unknown }>): ExtraSkillTag[] {
  if (!Array.isArray(value)) return [];
  const optionsById = new Map(categories.map((c) => [c.id, Array.isArray(c.options) ? (c.options as unknown[]) : []]));
  const byCategory = new Map<string, string>();
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const categoryId = (row as { categoryId?: unknown }).categoryId;
    const val = (row as { value?: unknown }).value;
    if (typeof categoryId === 'string' && typeof val === 'string' && optionsById.get(categoryId)?.includes(val)) {
      byCategory.set(categoryId, val);
    }
  }
  return [...byCategory.entries()].map(([categoryId, val]) => ({ categoryId, value: val }));
}
