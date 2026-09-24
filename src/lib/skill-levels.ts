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

/** How many crew of a given discipline + skill level a project asked for - purely informational
 * (it doesn't drive staffing automatically), set by an admin when a client specifies crew
 * requirements. See the Project model's `requestedCrew` field. */
export interface RequestedCrewItem {
  discipline: SkillDiscipline;
  level: SkillLevel;
  count: number;
}

/** Drops anything not shaped like { discipline, level, count } with recognised values. */
export function sanitizeRequestedCrew(value: unknown): RequestedCrewItem[] {
  if (!Array.isArray(value)) return [];
  const out: RequestedCrewItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const discipline = (row as { discipline?: unknown }).discipline;
    const level = (row as { level?: unknown }).level;
    const count = Number((row as { count?: unknown }).count);
    if (
      typeof discipline === 'string' &&
      isSkillDiscipline(discipline) &&
      typeof level === 'string' &&
      isSkillLevel(level) &&
      Number.isFinite(count) &&
      count > 0
    ) {
      out.push({ discipline, level, count: Math.min(50, Math.round(count)) });
    }
  }
  return out.slice(0, 20);
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
