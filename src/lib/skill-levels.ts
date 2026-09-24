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
