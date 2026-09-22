import { PIPELINE_STATUSES } from '@/lib/constants';

const STATUSES = Object.values(PIPELINE_STATUSES) as string[];

export const isPipelineStatus = (value: unknown): value is string => typeof value === 'string' && STATUSES.includes(value);

/** A date from the form (yyyy-mm-dd or an ISO string). Empty means "no date"; nonsense is reported, not stored. */
export function parseOptionalDate(value: unknown): { date: Date | null } | { error: string } {
  if (value === null || value === undefined || value === '') return { date: null };
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return { error: 'That date is not valid.' };
  return { date: d };
}

export const cleanTitle = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null;
