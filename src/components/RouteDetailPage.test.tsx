import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { FavouriteProvider } from '@/contexts/FavouriteContext';
import { FAVOURITES_STORAGE_KEY } from '@/lib/favourites';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { RouteDetailRequestError } from '@/lib/kmb';
import { RouteDetailPage } from './RouteDetailPage';
import type { ETAEntry, RouteDetail, RouteVariant } from '@/lib/types';

const fetchRouteDetailMock = vi.hoisted(() => vi.fn());
const fetchStopETAsMock = vi.hoisted(() => vi.fn());
let pathname = '/routes/87D';

vi.mock('@/lib/kmb', () => ({
  fetchRouteDetail: fetchRouteDetailMock,
  fetchStopETAs: fetchStopETAsMock,
  RouteDetailRequestError: class RouteDetailRequestError extends Error {
    constructor(readonly status: number, readonly retryAfterSeconds: number | null) {
      super(`Failed to fetch route detail: ${status}`);
    }
  },
}));
vi.mock('./RouteMap', () => ({
  RouteMap: ({ onSelectStop }: { onSelectStop: (stop: { stopId: string; seq: number }) => void }) => (
    <button type="button" onClick={() => onSelectStop({ stopId: 'STOP2', seq: 2 })}>Select stop on map</button>
  ),
}));
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a>,
}));

const baseVariant: RouteVariant = {
  route: '87D', bound: 'O', serviceType: '3', originEn: 'Ma On Shan Town Centre', originTc: '馬鞍山市中心',
  destinationEn: 'Hung Hom Station', destinationTc: '紅磡站', isSpecial: true,
};

const reverseVariant: RouteVariant = {
  route: '87D', bound: 'I', serviceType: '3', originEn: 'Hung Hom Station', originTc: '紅磡站',
  destinationEn: 'Ma On Shan Town Centre', destinationTc: '馬鞍山市中心', isSpecial: true,
};

function detail(reverseVariants: RouteVariant[] = [reverseVariant]): RouteDetail {
  return {
    variant: baseVariant,
    stops: [
      { stopId: 'STOP1', seq: 1, nameEn: 'First Stop', nameTc: '第一站', lat: 22.3, long: 114.1 },
      { stopId: 'STOP2', seq: 2, nameEn: 'Second Stop', nameTc: '第二站', lat: 22.31, long: 114.11 },
    ],
    reverseVariants,
  };
}

function eta(overrides: Partial<ETAEntry> = {}): ETAEntry {
  return {
    co: 'KMB', route: '87D', dir: 'O', service_type: '3', seq: 1, stop: 'STOP1',
    dest_en: 'Hung Hom Station', dest_tc: '紅磡站', dest_sc: '红磡站', eta_seq: 1,
    eta: '2026-09-11T12:03:00.000Z', rmk_en: '', rmk_tc: '', rmk_sc: '', data_timestamp: '', ...overrides,
  };
}

function response(data: ETAEntry[]) {
  return { type: 'ETA', version: '1', generated_timestamp: '', data };
}

function renderPage() {
  return render(
    <ThemeProvider>
      <FavouriteProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" /></LanguageProvider></FavouriteProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  pathname = '/routes/87D';
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-09-11T12:00:00.000Z'));
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('RouteDetailPage', () => {
  it('does not guess an occurrence for a legacy deep link and selects only the clicked row', async () => {
    const repeated = detail();
    repeated.stops.push({ ...repeated.stops[0], seq: 3, nameTc: '第一站回程' });
    fetchRouteDetailMock.mockResolvedValue(repeated);
    fetchStopETAsMock.mockResolvedValue(response([eta(), eta({ seq: 3, eta_seq: 2, eta: '2026-09-11T12:08:00.000Z' })]));
    render(<ThemeProvider><FavouriteProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" initialStopId="STOP1" /></LanguageProvider></FavouriteProvider></ThemeProvider>);
    await waitFor(() => expect(screen.getByText('此站在路線中出現多次，請選擇你要上車的站序。')).toBeDefined());
    expect(fetchStopETAsMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /第一站回程/ }));
    await waitFor(() => expect(screen.getByText('7 分')).toBeDefined());
    expect(screen.queryByText('2 分')).toBeNull();
    expect(screen.getByText('第一站').closest('button')?.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: '加入收藏' }));
    expect(JSON.parse(localStorage.getItem(FAVOURITES_STORAGE_KEY)!).items).toEqual([{ route: '87D', bound: 'O', serviceType: '3', stopId: 'STOP1', boardingSeq: 3 }]);
  });

  it('uses a valid sequence deep link and ignores a mismatched sequence', async () => {
    const repeated = detail();
    repeated.stops.push({ ...repeated.stops[0], seq: 3, nameTc: '第一站回程' });
    fetchRouteDetailMock.mockResolvedValue(repeated);
    fetchStopETAsMock.mockResolvedValue(response([]));
    const { rerender } = render(<ThemeProvider><FavouriteProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" initialStopId="STOP1" initialStopSeq={3} /></LanguageProvider></FavouriteProvider></ThemeProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: /第一站回程/ }).getAttribute('aria-expanded')).toBe('true'));
    expect(screen.getByText('第一站').closest('button')?.getAttribute('aria-expanded')).toBe('false');
    fetchStopETAsMock.mockClear();
    rerender(<ThemeProvider><FavouriteProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" initialStopId="STOP1" initialStopSeq={99} /></LanguageProvider></FavouriteProvider></ThemeProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: /第一站回程/ }).getAttribute('aria-expanded')).toBe('false'));
    expect(fetchStopETAsMock.mock.calls.every(([, options]) => options.signal.aborted)).toBe(true);
  });
  it('loads topology without ETA, then fetches and renders only the selected exact variant', async () => {
    fetchRouteDetailMock.mockResolvedValue(detail());
    fetchStopETAsMock.mockResolvedValue(response([
      eta(),
      eta({ service_type: '1', eta: '2026-09-11T13:00:00.000Z' }),
      eta({ route: '87X', eta: '2026-09-11T13:01:00.000Z' }),
      eta({ stop: 'STOP2', eta: '2026-09-11T13:02:00.000Z' }),
    ]));
    renderPage();

    await waitFor(() => expect(screen.getByText('第一站')).toBeDefined());
    expect(fetchStopETAsMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /第一站/ }));
    await waitFor(() => expect(fetchStopETAsMock).toHaveBeenCalledWith('STOP1', expect.objectContaining({ signal: expect.anything() })));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await waitFor(() => expect(screen.getByText('2 分')).toBeDefined());
    expect(screen.queryByText('59 分')).toBeNull();
    expect(screen.queryByText('60 分')).toBeNull();
    expect(screen.queryByText('61 分')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /第二站/ }));
    await waitFor(() => expect(fetchStopETAsMock).toHaveBeenCalledWith('STOP2', expect.objectContaining({ signal: expect.anything() })));
    expect(fetchStopETAsMock).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: /第二站/ }));
    expect(fetchStopETAsMock).toHaveBeenCalledTimes(2);
  });

  it('accepts a topology-confirmed nearby stop deep link and fetches only that stop', async () => {
    fetchRouteDetailMock.mockResolvedValue(detail());
    fetchStopETAsMock.mockResolvedValue(response([eta({ stop: 'STOP2', seq: 2 })]));
    render(
      <ThemeProvider>
        <FavouriteProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" initialStopId="stop2" /></LanguageProvider></FavouriteProvider>
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByText('第二站')).toBeDefined());
    await waitFor(() => expect(fetchStopETAsMock).toHaveBeenCalledWith('STOP2', expect.objectContaining({ signal: expect.anything() })));
    expect(fetchStopETAsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /第二站/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('selects a stop from the route map and loads its ETA', async () => {
    const scrollIntoView = vi.fn();
    const previousScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    try {
      fetchRouteDetailMock.mockResolvedValue(detail());
      fetchStopETAsMock.mockResolvedValue(response([]));
      renderPage();

      await waitFor(() => expect(screen.getByText('第二站')).toBeDefined());
      fireEvent.click(screen.getByRole('button', { name: 'Select stop on map' }));
      expect(screen.getByRole('button', { name: /第二站/ }).getAttribute('aria-expanded')).toBe('true');
      await waitFor(() => expect(fetchStopETAsMock).toHaveBeenCalledWith('STOP2', expect.objectContaining({ signal: expect.anything() })));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });

      fireEvent.click(screen.getByRole('button', { name: 'Select stop on map' }));
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    } finally {
      if (previousScrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', previousScrollIntoView);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
    }
  });

  it('silently ignores a stale or invalid nearby stop deep link without preloading ETA', async () => {
    fetchRouteDetailMock.mockResolvedValue(detail());
    render(
      <ThemeProvider>
        <FavouriteProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" initialStopId="NOT-ON-THIS-VARIANT" /></LanguageProvider></FavouriteProvider>
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByText('第一站')).toBeDefined());
    expect(fetchStopETAsMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /第一站/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('shows a direct reverse link for one trustworthy candidate and a choice for several', async () => {
    fetchRouteDetailMock.mockResolvedValue(detail());
    fetchStopETAsMock.mockResolvedValue(response([]));
    const { rerender } = render(
      <ThemeProvider><FavouriteProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" initialStopId="STOP1" /></LanguageProvider></FavouriteProvider></ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByText('查看反方向')).toBeDefined());
    const reverseLink = screen.getByRole('link', { name: '查看反方向' });
    expect(reverseLink.getAttribute('href')).toContain('bound=I&serviceType=3');
    expect(reverseLink.getAttribute('href')).not.toContain('stop=STOP1');

    const alternate: RouteVariant = { ...reverseVariant, serviceType: '1', isSpecial: false, destinationTc: '錦英苑', destinationEn: 'Kam Ying Court' };
    fetchRouteDetailMock.mockResolvedValue(detail([reverseVariant, alternate]));
    rerender(
      <ThemeProvider><FavouriteProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="1" /></LanguageProvider></FavouriteProvider></ThemeProvider>,
    );
    await waitFor(() => expect(screen.getAllByText('查看反方向').some((element) => element.tagName === 'SUMMARY')).toBe(true));
    fireEvent.click(screen.getAllByText('查看反方向').find((element) => element.tagName === 'SUMMARY')!);
    expect(screen.getByText('紅磡站 → 馬鞍山市中心')).toBeDefined();
    expect(screen.getByText('紅磡站 → 錦英苑')).toBeDefined();
  });

  it('retries a temporarily unavailable topology response and preserves the search query in links', async () => {
    fetchRouteDetailMock
      .mockRejectedValueOnce(new RouteDetailRequestError(503, 3))
      .mockResolvedValueOnce(detail());
    render(
      <ThemeProvider><FavouriteProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" searchQuery="87" /></LanguageProvider></FavouriteProvider></ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByText('暫時無法載入路線資料')).toBeDefined());
    expect(screen.getByRole('link', { name: '返回路線搜尋' }).getAttribute('href')).toBe('/routes?q=87');
    expect(screen.queryByText('Failed to fetch route detail: 503')).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '3 秒後重試' }).disabled).toBe(true);
    expect(console.error).toHaveBeenCalledWith('Route detail request failed', expect.objectContaining({ route: '87D', bound: 'O', serviceType: '3' }));
    fireEvent.click(screen.getByRole('button', { name: '3 秒後重試' }));
    expect(fetchRouteDetailMock).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    await waitFor(() => expect(screen.getByText('第一站')).toBeDefined());
    expect(fetchRouteDetailMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('link', { name: '查看反方向' }).getAttribute('href')).toContain('&q=87');
  });

  it('distinguishes an empty ETA response from an unavailable ETA service for a selected stop', async () => {
    fetchRouteDetailMock.mockResolvedValue(detail());
    fetchStopETAsMock
      .mockResolvedValueOnce(response([]))
      .mockRejectedValueOnce(new Error('KMB ETA unavailable'));
    renderPage();
    await waitFor(() => expect(screen.getByText('第一站')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /第一站/ }));
    await waitFor(() => expect(screen.getByText('暫無班次資料')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /第二站/ }));
    await waitFor(() => expect(screen.getByText('暫未能提供即時到站時間')).toBeDefined());
    expect(screen.getByText('暫未能提供到站時間')).toBeDefined();
  });

  it('shows a KMB remark instead of a dash when the selected stop has only null ETAs', async () => {
    fetchRouteDetailMock.mockResolvedValue(detail());
    fetchStopETAsMock.mockResolvedValue(response([eta({ eta: null, rmk_tc: '班次暫停' })]));
    renderPage();
    await waitFor(() => expect(screen.getByText('第一站')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /第一站/ }));
    await waitFor(() => expect(screen.getByText('班次暫停')).toBeDefined());
    expect(screen.queryByText('—')).toBeNull();
  });

  it('offers a route-stop favourite action only after a valid topology stop is selected', async () => {
    fetchRouteDetailMock.mockResolvedValue(detail());
    fetchStopETAsMock.mockResolvedValue(response([eta()]));
    renderPage();
    await waitFor(() => expect(screen.getByText('第一站')).toBeDefined());
    expect(screen.queryByRole('button', { name: '加入收藏' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /第一站/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: '加入收藏' })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: '加入收藏' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '移除收藏' })).toBeDefined());
    expect(JSON.parse(localStorage.getItem(FAVOURITES_STORAGE_KEY)!).items).toEqual([
      { route: '87D', bound: 'O', serviceType: '3', stopId: 'STOP1', boardingSeq: 1 },
    ]);
  });
});
