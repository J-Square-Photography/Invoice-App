import { SKILL_DISCIPLINES, SKILL_LEVELS, isSkillDiscipline, type SkillDiscipline, type SkillLevel, type StaffSkill } from './skill-levels';

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

/** Every skill level a staff member trained to `trainedLevel` is allowed to bill a specific shift
 * at - the ladder up to and including their trained level (e.g. trained to Enthusiast can bill a
 * shift as Beginner, Novice or Enthusiast, but never Professional or Director). */
export function eligibleSkillLevelsFor(trainedLevel: SkillLevel): SkillLevel[] {
  const idx = SKILL_LEVELS.indexOf(trainedLevel);
  return SKILL_LEVELS.slice(0, idx + 1);
}

/** The rate card's hourly pay for an explicitly chosen discipline + level (as opposed to
 * `staffHourlyRateFor`, which always uses the staff member's max trained level). */
export function rateForLevel(discipline: SkillDiscipline, level: SkillLevel): number {
  return STAFF_HOURLY_RATE_CARD[discipline][level];
}

/** The skill level, if any, whose rate-card price matches a snapshotted hourly rate - the reverse
 * of `rateForLevel`, used to pre-select a shift's level when editing it. */
export function levelForRate(discipline: SkillDiscipline, hourlyRate: number): SkillLevel | null {
  return (Object.entries(STAFF_HOURLY_RATE_CARD[discipline]) as Array<[SkillLevel, number]>).find(([, rate]) => rate === hourlyRate)?.[0] ?? null;
}

export { SKILL_DISCIPLINES };

// ==================== Photobooth crew pay ====================
// Unlike Photography/Videography, a Photobooth crew member's pay doesn't depend on a trained skill
// level - every Main/Assistant is paid the same rate, which instead depends on which package the
// client booked (see photobooth-presets.ts: Package A vs B/C). So this is a separate, smaller rate
// card keyed by role + package tier rather than by skill level.

export const PHOTOBOOTH_ROLES = ['Main', 'Assistant'] as const;
export type PhotoboothRole = (typeof PHOTOBOOTH_ROLES)[number];

export const PHOTOBOOTH_DISCIPLINES = PHOTOBOOTH_ROLES.map((r) => `Photobooth: ${r}`) as [
  `Photobooth: ${PhotoboothRole}`,
  `Photobooth: ${PhotoboothRole}`,
];
export type PhotoboothDiscipline = (typeof PHOTOBOOTH_DISCIPLINES)[number];

export function isPhotoboothDiscipline(value: string): value is PhotoboothDiscipline {
  return (PHOTOBOOTH_DISCIPLINES as readonly string[]).includes(value);
}

export function photoboothRoleFromDiscipline(discipline: PhotoboothDiscipline): PhotoboothRole {
  return discipline.replace('Photobooth: ', '') as PhotoboothRole;
}

/** Any discipline that can be logged on a shift and priced - the skill-ladder disciplines
 * (Photography/Videography) or a Photobooth crew role. */
export function isLoggableDiscipline(value: string): value is SkillDiscipline | PhotoboothDiscipline {
  return isSkillDiscipline(value) || isPhotoboothDiscipline(value);
}

/** "A" for Package A, or "BC" for Package B or C (which are paid the same) - the client's chosen
 * package tier, picked by hand when logging a Photobooth shift since a project has no single
 * structured "package" field of its own (only free-text invoice line items). */
export const PHOTOBOOTH_PACKAGE_TIERS = ['A', 'BC'] as const;
export type PhotoboothPackageTier = (typeof PHOTOBOOTH_PACKAGE_TIERS)[number];

export function isPhotoboothPackageTier(value: unknown): value is PhotoboothPackageTier {
  return (PHOTOBOOTH_PACKAGE_TIERS as readonly unknown[]).includes(value);
}

export const PHOTOBOOTH_HOURLY_RATE_CARD: Record<PhotoboothRole, Record<PhotoboothPackageTier, number>> = {
  Main: { A: 20, BC: 16 },
  Assistant: { A: 15, BC: 13 },
};

/** Flat pay for physically picking up or dropping off the equipment, on top of the hourly rate -
 * each is independently toggled per shift (see the equipmentPickup/equipmentDropoff timesheet
 * fields) and rolled into the payslip as its own allowance line (see /api/payslips). */
export const PHOTOBOOTH_EQUIPMENT_FLAT_RATE = 10;

export function photoboothHourlyRateFor(role: PhotoboothRole, tier: PhotoboothPackageTier): number {
  return PHOTOBOOTH_HOURLY_RATE_CARD[role][tier];
}

export function photoboothGroupLabel(role: PhotoboothRole, tier: PhotoboothPackageTier): string {
  return `Photobooth: ${role} (Package ${tier === 'A' ? 'A' : 'B/C'})`;
}

/** The name of the SkillCategory row used to tag Photobooth crew on a staff profile. Unlike other
 * admin-defined categories, this one can't be deleted (see /api/skill-categories/[id]) because the
 * Photobooth discipline/pay logic above is hardcoded around it. */
export const PHOTOBOOTH_SKILL_CATEGORY_NAME = 'DSLR Photobooth';

/** One payslip breakdown row's label for a logged shift, given its (possibly missing) discipline
 * and snapshotted rate - shared between generating a payslip and recomputing one after a shift is
 * removed from it, so the label logic never drifts between the two call sites. */
export function shiftGroupLabel(discipline: string | null, hourlyRate: number, photoboothPackage?: string | null): string {
  if (discipline && isSkillDiscipline(discipline)) return groupLabelFor(discipline, hourlyRate);
  if (discipline && isPhotoboothDiscipline(discipline) && isPhotoboothPackageTier(photoboothPackage)) {
    return photoboothGroupLabel(photoboothRoleFromDiscipline(discipline), photoboothPackage);
  }
  if (discipline) return `${discipline} ($${hourlyRate.toFixed(2)}/hr)`;
  return `Manual Rate ($${hourlyRate.toFixed(2)}/hr)`;
}
