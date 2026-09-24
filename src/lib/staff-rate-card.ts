import { SKILL_DISCIPLINES, type SkillDiscipline, type SkillLevel, type StaffSkill } from './skill-levels';

/**
 * What the studio pays its own staff per hour, by discipline and trained skill level - the client
 * is charged roughly double this (see service-presets.ts for the client-facing prices), the
 * difference being the studio's margin. Hardcoded here the same way the client-facing prices are,
 * rather than an editable settings table, so it's one place to change if pay rates change.
 */
export const STAFF_HOURLY_RATE_CARD: Record<SkillDiscipline, Record<SkillLevel, number>> = {
  Photography: { Beginner: 15, Novice: 30, Enthusiast: 60, Professional: 75, Director: 100 },
  Videography: { Beginner: 30, Novice: 50, Enthusiast: 100, Professional: 150, Director: 200 },
};

/** The level a staff member is trained to in a discipline, or null if they aren't tagged for it. */
export function skillLevelFor(skills: StaffSkill[] | null | undefined, discipline: SkillDiscipline): SkillLevel | null {
  return skills?.find((s) => s.discipline === discipline)?.level ?? null;
}

/** The hourly pay rate for a staff member's shift in a given discipline, from their trained skill
 * level and the rate card - or null if they have no level set for that discipline (an admin has to
 * supply a rate by hand in that case, rather than the system guessing one). */
export function staffHourlyRateFor(skills: StaffSkill[] | null | undefined, discipline: SkillDiscipline): number | null {
  const level = skillLevelFor(skills, discipline);
  if (!level) return null;
  return STAFF_HOURLY_RATE_CARD[discipline][level];
}

/** A display label for a payslip breakdown row, e.g. "Photography (Enthusiast)" if the rate still
 * matches a level on the current rate card, or just "Photography ($60.00/hr)" if it doesn't (the
 * rate card changed since, or it was a manual override) - the rate itself is always what was
 * actually snapshotted on the shift, this is only ever used as a label. */
export function groupLabelFor(discipline: SkillDiscipline, hourlyRate: number): string {
  const level = (Object.entries(STAFF_HOURLY_RATE_CARD[discipline]) as Array<[SkillLevel, number]>).find(([, rate]) => rate === hourlyRate)?.[0];
  return level ? `${discipline} (${level})` : `${discipline} ($${hourlyRate.toFixed(2)}/hr)`;
}

export { SKILL_DISCIPLINES };
