import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { RouteDetailPage } from './RouteDetailPage';
import type { ETAEntry, RouteDetail, RouteVariant } from '@/lib/types';

const fetchRouteDetailMock = vi.hoisted(() => vi.fn());
const fetchStopETAsMock = vi.hoisted(() => vi.fn());
let pathname = '/routes/87D';

vi.mock('@/lib/kmb', () => ({
  fetchRouteDetail: fetchRouteDetailMock,
  fetchStopETAs: fetchStopETAsMock,
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
      <LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" /></LanguageProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  pathname = '/routes/87D';
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-09-11T12:00:00.000Z'));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('RouteDetailPage', () => {
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
        <LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" initialStopId="stop2" /></LanguageProvider>
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByText('第二站')).toBeDefined());
    await waitFor(() => expect(fetchStopETAsMock).toHaveBeenCalledWith('STOP2', expect.objectContaining({ signal: expect.anything() })));
    expect(fetchStopETAsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /第二站/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('silently ignores a stale or invalid nearby stop deep link without preloading ETA', async () => {
    fetchRouteDetailMock.mockResolvedValue(detail());
    render(
      <ThemeProvider>
        <LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" initialStopId="NOT-ON-THIS-VARIANT" /></LanguageProvider>
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
      <ThemeProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" initialStopId="STOP1" /></LanguageProvider></ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByText('查看反方向')).toBeDefined());
    const reverseLink = screen.getByRole('link', { name: '查看反方向' });
    expect(reverseLink.getAttribute('href')).toContain('bound=I&serviceType=3');
    expect(reverseLink.getAttribute('href')).not.toContain('stop=STOP1');

    const alternate: RouteVariant = { ...reverseVariant, serviceType: '1', isSpecial: false, destinationTc: '錦英苑', destinationEn: 'Kam Ying Court' };
    fetchRouteDetailMock.mockResolvedValue(detail([reverseVariant, alternate]));
    rerender(
      <ThemeProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="1" /></LanguageProvider></ThemeProvider>,
    );
    await waitFor(() => expect(screen.getAllByText('查看反方向').some((element) => element.tagName === 'SUMMARY')).toBe(true));
    fireEvent.click(screen.getAllByText('查看反方向').find((element) => element.tagName === 'SUMMARY')!);
    expect(screen.getByText('紅磡站 → 馬鞍山市中心')).toBeDefined();
    expect(screen.getByText('紅磡站 → 錦英苑')).toBeDefined();
  });

  it('retries a temporarily unavailable topology response and preserves the search query in links', async () => {
    fetchRouteDetailMock
      .mockRejectedValueOnce(new Error('Failed to fetch route detail: 503'))
      .mockResolvedValueOnce(detail());
    render(
      <ThemeProvider><LanguageProvider><RouteDetailPage route="87D" bound="O" serviceType="3" searchQuery="87" /></LanguageProvider></ThemeProvider>,
    );
    await waitFor(() => expect(screen.getByText('暫時無法載入路線資料')).toBeDefined());
    expect(screen.getByRole('link', { name: '返回路線搜尋' }).getAttribute('href')).toBe('/routes?q=87');
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
});
