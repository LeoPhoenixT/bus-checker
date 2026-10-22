import { describe, expect, it, vi } from 'vitest';
import RoutePage from './page';

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('@/components/CitybusRouteDetailPage', () => ({ CitybusRouteDetailPage: () => null }));
vi.mock('@/components/RouteDetailPage', () => ({ RouteDetailPage: () => null }));

describe('route detail page dispatch', () => {
  it('accepts Citybus search deep links without KMB direction or service type', async () => {
    const page = await RoutePage({ params: Promise.resolve({ route: '1' }), searchParams: Promise.resolve({ operator: 'CTB', q: '1', filter: 'CTB' }) });
    expect(page.props).toMatchObject({ route: '1', bound: undefined, searchQuery: '1', searchFilter: 'CTB' });
    expect(page.props).not.toHaveProperty('serviceType');
  });
  it('preserves the legacy KMB identity and exact selected sequence', async () => {
    const page = await RoutePage({ params: Promise.resolve({ route: '87D' }), searchParams: Promise.resolve({ bound: 'O', serviceType: '3', stop: 'STOP1', seq: '2' }) });
    expect(page.props).toMatchObject({ route: '87D', bound: 'O', serviceType: '3', initialStopId: 'STOP1', initialStopSeq: 2 });
  });
  it.each([{ operator: 'CTB', bound: 'X' }, { operator: 'UNKNOWN' }, { bound: 'O' }])('rejects invalid provider-specific identities %j', async (query) => {
    await expect(RoutePage({ params: Promise.resolve({ route: '1' }), searchParams: Promise.resolve(query) })).rejects.toThrow('NOT_FOUND');
  });
});
