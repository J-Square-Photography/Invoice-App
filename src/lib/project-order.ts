import { byDate, type Compare } from '@/lib/sorting';

/**
 * The default order for the Projects list: work that still needs doing comes first, finished and
 * closed work last. Most urgent first:
 *   In progress, Booked, Quoted, Inquiry  (still to be delivered)
 *   Delivered
 *   Closed
 */
export const PIPELINE_RANK: Record<string, number> = {
  IN_PROGRESS: 0,
  BOOKED: 1,
  QUOTED: 2,
  INQUIRY: 3,
  DELIVERED: 4,
  CLOSED: 5,
};

const rankOf = (status: string) => PIPELINE_RANK[status] ?? 3;
const STILL_OPEN = 4; // ranks below this are not yet delivered

export function byPipelineOrder<T extends { pipelineStatus: string; shootDate?: string | Date | null; createdAt?: string | Date | null }>(): Compare<T> {
  const upcomingFirst = byDate<T>((p) => p.shootDate, 'asc');
  const newestFirst = byDate<T>((p) => p.shootDate, 'desc');
  const recentlyAdded = byDate<T>((p) => p.createdAt, 'desc');
  return (a, b) => {
    const ra = rankOf(a.pipelineStatus);
    const rb = rankOf(b.pipelineStatus);
    if (ra !== rb) return ra - rb;
    // Within a group: open work by shoot date (earliest, i.e. most pressing, first); finished work newest first
    const byShoot = ra < STILL_OPEN ? upcomingFirst(a, b) : newestFirst(a, b);
    return byShoot !== 0 ? byShoot : recentlyAdded(a, b);
  };
}
