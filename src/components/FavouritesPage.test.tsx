import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FavouriteProvider } from '@/contexts/FavouriteContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FAVOURITES_STORAGE_KEY, serializeFavourites } from '@/lib/favourites';
import { FavouritesPage } from './FavouritesPage';
import type { ETAEntry, FavouriteRouteStopMetadata } from '@/lib/types';

const fetchFavouriteRouteStopMetadataMock = vi.hoisted(() => vi.fn());
const fetchStopETAsMock = vi.hoisted(() => vi.fn());
let pathname = '/favourites';

vi.mock('@/lib/kmb', () => ({
  fetchFavouriteRouteStopMetadata: fetchFavouriteRouteStopMetadataMock,
  fetchStopETAs: fetchStopETAsMock,
}));
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a> }));

const first = { route: '87D', bound: 'O' as const, serviceType: '1', stopId: 'STOP1' };
const second = { route: '87D', bound: 'O' as const, serviceType: '3', stopId: 'STOP1' };

function metadata(favourite = first): FavouriteRouteStopMetadata {
  return {
    favourite,
    status: 'resolved',
    variant: { route: favourite.route, bound: favourite.bound, serviceType: favourite.serviceType, originEn: 'Origin', originTc: '起點', destinationEn: 'Destination', destinationTc: '目的地', isSpecial: favourite.serviceType !== '1' },
    stop: { stopId: favourite.stopId, seq: 1, nameEn: 'Boarding stop', nameTc: '上車站', lat: 22.3, long: 114.1 },
  };
}

function eta(overrides: Partial<ETAEntry> = {}): ETAEntry {
  return { co: 'KMB', route: '87D', dir: 'O', service_type: '1', seq: 1, stop: 'STOP1', dest_en: 'Destination', dest_tc: '目的地', dest_sc: '', eta_seq: 1, eta: new Date(Date.now() + 180_000).toISOString(), rmk_en: '', rmk_tc: '', rmk_sc: '', data_timestamp: '', ...overrides };
}

function renderPage(items = [first]) {
  localStorage.setItem(FAVOURITES_STORAGE_KEY, serializeFavourites(items));
  return render(<ThemeProvider><FavouriteProvider><LanguageProvider><FavouritesPage /></LanguageProvider></FavouriteProvider></ThemeProvider>);
}

beforeEach(() => {
  pathname = '/favourites';
  localStorage.clear();
  fetchStopETAsMock.mockResolvedValue({ type: 'ETA', version: '1', generated_timestamp: '', data: [eta(), eta({ service_type: '3', eta_seq: 2, eta: new Date(Date.now() + 600_000).toISOString() })] });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

describe('FavouritesPage', () => {
  it('deduplicates ETA requests by stop while preserving exact saved variants', async () => {
    fetchFavouriteRouteStopMetadataMock.mockResolvedValue([metadata(first), metadata(second)]);
    renderPage([first, second]);
    await waitFor(() => expect(fetchStopETAsMock).toHaveBeenCalledWith('STOP1', expect.objectContaining({ signal: expect.anything() })));
    expect(fetchStopETAsMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getAllByText('上車站')).toHaveLength(2));
    expect(screen.getAllByRole('link', { name: /87D/ }).map((link) => link.getAttribute('href'))).toEqual([
      '/routes/87D?bound=O&serviceType=1&stop=STOP1',
      '/routes/87D?bound=O&serviceType=3&stop=STOP1',
    ]);
  });

  it('keeps a missing route-stop removable and does not present its ETA as live', async () => {
    fetchFavouriteRouteStopMetadataMock.mockResolvedValue([{ favourite: first, status: 'missing' }]);
    renderPage();
    await waitFor(() => expect(screen.getByText('此收藏站點已不在這個路線班次上')).toBeDefined());
    expect(screen.getByText('暫未能提供到站時間')).toBeDefined();
    expect(screen.getByRole('button', { name: '移除87D收藏' })).toBeDefined();
  });

  it('keeps independently unavailable metadata distinct from a deleted route-stop', async () => {
    fetchFavouriteRouteStopMetadataMock.mockResolvedValue([{ favourite: first, status: 'unavailable' }]);
    renderPage();
    await waitFor(() => expect(screen.getByText('暫時無法載入路線資料')).toBeDefined());
    expect(screen.queryByText('此收藏站點已不在這個路線班次上')).toBeNull();
    expect(screen.getByText('暫未能提供到站時間')).toBeDefined();
  });

  it('shows a useful empty state', async () => {
    renderPage([]);
    await waitFor(() => expect(screen.getByText('尚未有收藏')).toBeDefined());
    expect(screen.getByRole('link', { name: '搜尋路線' }).getAttribute('href')).toBe('/routes');
  });
});
