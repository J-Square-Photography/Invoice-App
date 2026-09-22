import { describe, it, expect } from 'vitest';
import { byPipelineOrder } from '../project-order';

type P = { id: string; pipelineStatus: string; shootDate: string | null; createdAt: string };
const p = (id: string, pipelineStatus: string, shootDate: string | null, createdAt = '2026-01-01'): P => ({ id, pipelineStatus, shootDate, createdAt });

const order = (list: P[]) => [...list].sort(byPipelineOrder<P>()).map((x) => x.id);

describe('project list default order', () => {
  it('puts open work first, then delivered, then closed', () => {
    const list = [p('closed', 'CLOSED', '2026-01-01'), p('delivered', 'DELIVERED', '2026-02-01'), p('inquiry', 'INQUIRY', null), p('quoted', 'QUOTED', null), p('booked', 'BOOKED', '2026-11-01'), p('progress', 'IN_PROGRESS', '2026-10-01')];
    expect(order(list)).toEqual(['progress', 'booked', 'quoted', 'inquiry', 'delivered', 'closed']);
  });

  it('within open work, the earliest shoot date comes first and undated ones last', () => {
    const list = [p('none', 'BOOKED', null), p('dec', 'BOOKED', '2026-12-01'), p('oct', 'BOOKED', '2026-10-01')];
    expect(order(list)).toEqual(['oct', 'dec', 'none']);
  });

  it('within delivered and closed, the most recent shoot comes first', () => {
    const list = [p('old', 'DELIVERED', '2026-01-01'), p('new', 'DELIVERED', '2026-06-01'), p('closedOld', 'CLOSED', '2026-02-01'), p('closedNew', 'CLOSED', '2026-08-01')];
    expect(order(list)).toEqual(['new', 'old', 'closedNew', 'closedOld']);
  });

  it('breaks ties by most recently added', () => {
    const list = [p('a', 'QUOTED', null, '2026-01-01'), p('b', 'QUOTED', null, '2026-03-01')];
    expect(order(list)).toEqual(['b', 'a']);
  });
});
