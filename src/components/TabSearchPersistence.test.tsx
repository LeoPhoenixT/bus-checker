import { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { AppProviders } from './AppProviders';
import { PrimaryNavigation } from './PrimaryNavigation';
import { RouteSearchPage } from './RouteSearchPage';
import type { ETAEntry, NearbyStop } from '@/lib/types';
import { installNavigationHistory } from '@/test-utils/navigation';

const nearby = vi.hoisted(() => ({
  stops: [] as NearbyStop[],
  etasMap: {} as Record<string, ETAEntry[]>,
}));
const navigation = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', async () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: (await import('@/test-utils/navigation')).useTestSearchParams,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props} onClick={(event) => {
      event.preventDefault();
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }}>{children}</a>
  ),
}));
vi.mock('@/hooks/useGeolocation', () => ({ useGeolocation: () => ({
  coords: { latitude: 22.3, longitude: 114.2 }, error: null, loading: false, supported: true, refresh: vi.fn(),
}) }));
vi.mock('@/hooks/useNearbyStops', () => ({ useNearbyStops: () => ({ stops: nearby.stops, destinationStops: [], loading: false, error: null }) }));
vi.mock('@/hooks/useDirectRoutes', () => ({ useDirectRoutes: () => ({ matchesByOriginStop: {}, loading: false, error: null }) }));
vi.mock('@/hooks/useStopETAs', () => ({ useStopETAs: () => ({
  etasMap: nearby.etasMap, etaStates: {}, lastRefreshed: null, lastAttemptAt: null, failedStopCount: 0, loading: false, refresh: vi.fn(),
}) }));
vi.mock('@/hooks/useRouteSearch', () => ({ useRouteSearch: (query: string) => ({
  routes: query ? [{ operator: 'CTB', route: query, originEn: 'Central', originTc: '中環', destinationEn: 'Happy Valley', destinationTc: '跑馬地' }] : [],
  truncated: false, loading: false, complete: true,
  sources: { KMB: { status: 'success' }, CTB: { status: 'success' } },
}) }));
vi.mock('./DestinationModal', () => ({ DestinationModal: () => null }));

// Simulate page unmounts while retaining the same root provider, as the App Router does.
function TestApp() {
  const [href, setHref] = useState(window.location.href);
  useEffect(() => {
    const restore = () => setHref(window.location.href);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const url = new URL(href);
  navigation.pathname = url.pathname;
  return <AppProviders>
    {url.pathname === '/' ? <Home /> : url.pathname === '/routes'
      ? <RouteSearchPage />
      : <><p>{url.pathname.startsWith('/routes/') ? '路線詳情測試頁' : '收藏測試頁'}</p><PrimaryNavigation /></>}
  </AppProviders>;
}

function clickTab(name: string) {
  fireEvent.click(screen.getAllByRole('link', { name })[0]);
}
function navigate(href: string) {
  act(() => {
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}
function queryInput() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: '搜尋路線號碼' });
}

beforeEach(() => {
  nearby.stops = [];
  nearby.etasMap = {};
  window.history.replaceState({}, '', '/');
  installNavigationHistory();
});
afterEach(() => {
  cleanup();
  window.localStorage.removeItem('theme');
  vi.restoreAllMocks();
});

describe('tab search persistence', () => {
  it.each(['all', 'KMB'] as const)('restores edited URL state after Favourites and browser Back with %s operator', async (filter) => {
    render(<TestApp />);
    clickTab('路線');
    fireEvent.change(queryInput(), { target: { value: '87D' } });
    if (filter === 'KMB') fireEvent.click(screen.getByRole('button', { name: '九巴' }));
    const search = filter === 'KMB' ? '?q=87D&operator=KMB' : '?q=87D';
    const operatorName = filter === 'KMB' ? '九巴' : '全部';
    clickTab('收藏');
    act(() => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe('/routes'));
    expect(window.location.search).toBe(search);
    expect(queryInput().value).toBe('87D');
    expect(screen.getByRole('button', { name: operatorName }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('link', { name: '路線' }).every((link) => link.getAttribute('href') === `/routes${search}`)).toBe(true);

    act(() => window.history.forward());
    await waitFor(() => expect(screen.getByText('收藏測試頁')).toBeDefined());
    clickTab('路線');
    expect(queryInput().value).toBe('87D');
    expect(screen.getByRole('button', { name: operatorName }).getAttribute('aria-pressed')).toBe('true');
  });

  it('retains the actual nearby page draft, route chips and ETA toggle across other tabs', () => {
    render(<TestApp />);
    expect(screen.getByRole<HTMLInputElement>('switch', { name: '顯示沒有到站時間的路線' }).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Show routes without ETA' }).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Traditional Chinese' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '74b' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: '87d' } });
    fireEvent.click(screen.getByRole('switch'));

    clickTab('路線');
    fireEvent.change(queryInput(), { target: { value: 'B1' } });
    clickTab('收藏');
    clickTab('附近');
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('87D');
    expect(screen.getByRole('button', { name: '移除篩選 74B' })).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>('switch').checked).toBe(false);

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('');
    expect(screen.getByRole('button', { name: '移除篩選 87D' })).toBeDefined();
    clickTab('收藏');
    clickTab('附近');
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('');
    expect(screen.getByRole('button', { name: '移除篩選 87D' })).toBeDefined();
  });

  it('remembers query and operator in both tab links, including return from route details', () => {
    render(<TestApp />);
    clickTab('路線');
    fireEvent.change(queryInput(), { target: { value: ' b1 ' } });
    fireEvent.click(screen.getByRole('button', { name: '城巴' }));
    expect(window.location.search).toBe('?q=B1&operator=CTB');
    fireEvent.click(screen.getByRole('link', { name: /往 跑馬地/ }));
    expect(screen.getByText('路線詳情測試頁')).toBeDefined();
    expect(screen.getAllByRole('link', { name: '路線' }).every((link) => link.getAttribute('href') === '/routes?q=B1&operator=CTB')).toBe(true);
    clickTab('路線');
    expect(queryInput().value).toBe('B1');
    expect(screen.getByRole('button', { name: '城巴' }).getAttribute('aria-pressed')).toBe('true');
    clickTab('附近');
    clickTab('收藏');
    clickTab('路線');
    expect(queryInput().value).toBe('B1');
    expect(screen.getByRole('button', { name: '城巴' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('honours deep links, explicit empty searches and browser back/forward over remembered state', async () => {
    render(<TestApp />);
    clickTab('路線');
    fireEvent.change(queryInput(), { target: { value: 'B1' } });
    fireEvent.click(screen.getByRole('button', { name: '城巴' }));
    clickTab('收藏');
    navigate('/routes?q=87D&operator=KMB');
    expect(queryInput().value).toBe('87D');
    expect(screen.getByRole('button', { name: '九巴' }).getAttribute('aria-pressed')).toBe('true');
    navigate('/routes?q=&operator=CTB');
    expect(queryInput().value).toBe('');
    expect(screen.getByRole('button', { name: '城巴' }).getAttribute('aria-pressed')).toBe('true');
    act(() => window.history.back());
    await waitFor(() => expect(queryInput().value).toBe('87D'));
    expect(window.location.search).toBe('?q=87D&operator=KMB');
    act(() => window.history.forward());
    await waitFor(() => expect(queryInput().value).toBe(''));
    expect(window.location.search).toBe('?q=&operator=CTB');
    navigate('/routes');
    expect(queryInput().value).toBe('');
    expect(screen.getByRole('button', { name: '全部' }).getAttribute('aria-pressed')).toBe('true');
    clickTab('收藏');
    clickTab('路線');
    expect(window.location.pathname + window.location.search).toBe('/routes');
  });
});


describe('Nearby arrivals board', () => {
  it('only links to rendered stop groups when the route filter changes', () => {
    nearby.stops = [
      { stop: 'STOP1', name_tc: '旺角站', name_en: 'Mong Kok Station', name_sc: '', distanceM: 30, lat: 22.3, long: 114.2, data_timestamp: '' },
      { stop: 'STOP2', name_tc: '旺角中心', name_en: 'Argyle Centre', name_sc: '', distanceM: 80, lat: 22.3, long: 114.2, data_timestamp: '' },
    ];
    nearby.etasMap.STOP1 = [{
      co: 'KMB', route: '74B', dir: 'O', service_type: '1', seq: 2, stop: 'STOP1', eta_seq: 1, eta: null,
      dest_tc: '大埔中心', dest_en: 'Tai Po Centre', dest_sc: '', rmk_tc: '', rmk_en: '', rmk_sc: '', data_timestamp: '',
    }];
    render(<TestApp />);
    const index = within(screen.getByRole('navigation', { name: '跳至附近巴士站' }));
    expect(index.getAllByRole('link')).toHaveLength(2);

    const input = screen.getByRole('textbox', { name: '按路線號碼篩選' });
    fireEvent.change(input, { target: { value: '74B' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const links = index.getAllByRole('link');
    expect(links).toHaveLength(1);
    const target = links[0].getAttribute('href')!;
    expect(document.getElementById(target.slice(1))).toBe(screen.getByRole('article'));
    expect(screen.queryByRole('heading', { name: '旺角中心' })).toBeNull();
  });

  it('uses one theme action and restores the chosen theme after remounting the app', () => {
    const first = render(<TestApp />);
    const sun = screen.getByRole('button', { name: '切換至亮色模式' });
    expect(sun.textContent).toBe('');
    fireEvent.click(sun);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBe(sun);
    first.unmount();

    render(<TestApp />);
    expect(screen.getByRole('button', { name: '切換至深色模式' })).toBeDefined();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
