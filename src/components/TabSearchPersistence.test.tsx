import { useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { AppProviders } from './AppProviders';
import { PrimaryNavigation } from './PrimaryNavigation';
import { RouteSearchPage } from './RouteSearchPage';
import { isRouteOperatorFilter } from '@/lib/routeSearch';

const navigation = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
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
vi.mock('@/hooks/useNearbyStops', () => ({ useNearbyStops: () => ({ stops: [], destinationStops: [], loading: false, error: null }) }));
vi.mock('@/hooks/useDirectRoutes', () => ({ useDirectRoutes: () => ({ matchesByOriginStop: {}, loading: false, error: null }) }));
vi.mock('@/hooks/useStopETAs', () => ({ useStopETAs: () => ({
  etasMap: {}, etaStates: {}, lastRefreshed: null, lastAttemptAt: null, failedStopCount: 0, loading: false, refresh: vi.fn(),
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
  const operator = url.searchParams.get('operator');
  return <AppProviders>
    {url.pathname === '/' ? <Home /> : url.pathname === '/routes'
      ? <RouteSearchPage initialQuery={url.searchParams.get('q') ?? ''} initialFilter={isRouteOperatorFilter(operator) ? operator : 'all'} />
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

beforeEach(() => { window.history.replaceState({}, '', '/'); });
afterEach(cleanup);

describe('tab search persistence', () => {
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
