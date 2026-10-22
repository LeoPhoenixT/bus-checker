import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CitybusRouteDetailPage } from './CitybusRouteDetailPage';
import type { CitybusETAResponse, CitybusRouteDetail } from '@/lib/citybusTypes';

const fetchDetail = vi.hoisted(() => vi.fn());
const fetchETA = vi.hoisted(() => vi.fn());
vi.mock('@/lib/routes', () => ({ fetchCitybusRouteDetail: fetchDetail, fetchCitybusRouteETA: fetchETA }));
vi.mock('next/navigation', () => ({ usePathname: () => '/routes/1' }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a> }));
vi.mock('./RouteMap', () => ({ RouteMap: ({ stops, onSelectStop }: { stops: { stopId: string; seq: number }[]; onSelectStop: (stop: { stopId: string; seq: number }) => void }) => <div data-testid="map"><span>{stops.length} map stops</span><button onClick={() => onSelectStop(stops[1])}>Select repeated map stop</button></div> }));

const detail: CitybusRouteDetail = {
  variant: { operator: 'CTB', route: '1', bound: 'O', originEn: 'Central', originTc: '中環', destinationEn: 'Happy Valley', destinationTc: '跑馬地' },
  directions: [{ bound: 'O', status: 'available' }, { bound: 'I', status: 'available' }],
  stops: [
    { status: 'resolved', stop: { stopId: '000001', seq: 1, nameEn: 'Central', nameTc: '中環站', lat: 22.28, long: 114.15 } },
    { status: 'unavailable', stopId: '000002', seq: 2 },
    { status: 'resolved', stop: { stopId: '000001', seq: 3, nameEn: 'Central', nameTc: '中環站', lat: 22.28, long: 114.15 } },
  ],
};
const response: CitybusETAResponse = { generated_timestamp: '2026-10-14T12:00:00+08:00', data: [] };
function renderPage() {
  return render(<ThemeProvider><LanguageProvider><CitybusRouteDetailPage route="1" searchQuery="1" searchFilter="CTB" /></LanguageProvider></ThemeProvider>);
}
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-10-14T12:00:00+08:00'));
  fetchDetail.mockReset().mockResolvedValue(detail); fetchETA.mockReset().mockResolvedValue(response);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Citybus route detail', () => {
  it('shows directions and exact repeated occurrences, retains failed stops and has no favourite action', async () => {
    renderPage();
    await waitFor(() => expect(screen.getAllByText('中環站')).toHaveLength(2));
    expect(screen.getByText('2 map stops')).toBeDefined();
    expect(screen.getByText('000002 · 站點資料未能載入')).toBeDefined();
    expect(fetchETA).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /收藏/ })).toBeNull();
    expect(screen.getByRole('link', { name: '回程' }).getAttribute('href')).toBe('/routes/1?operator=CTB&bound=I&q=1&filter=CTB');
    expect(screen.getByRole('link', { name: /城巴 · 路線詳情/ }).getAttribute('href')).toBe('/routes?q=1&operator=CTB');
    fireEvent.click(screen.getByRole('button', { name: 'Select repeated map stop' }));
    await waitFor(() => expect(fetchETA).toHaveBeenCalledWith('1', 'O', '000001', 3, expect.anything()));
  });

  it('can query ETA even if a selected stop metadata request failed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/000002/)).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /000002/ }));
    await waitFor(() => expect(fetchETA).toHaveBeenCalledWith('1', 'O', '000002', 2, expect.anything()));
  });

  it('keeps joint-operation notices and hides old predictions after the source-age limit', async () => {
    fetchETA.mockResolvedValue({ generated_timestamp: response.generated_timestamp, data: [
      { co: 'CTB', route: '1', dir: 'O', seq: 1, stop: '000001', eta_seq: 1, eta: null, dest_en: 'Happy Valley', dest_tc: '跑馬地', dest_sc: '', rmk_en: 'KMB Cycle', rmk_tc: '九巴時段', rmk_sc: '', data_timestamp: response.generated_timestamp },
      { co: 'CTB', route: '1', dir: 'O', seq: 1, stop: '000001', eta_seq: 2, eta: '2026-10-14T12:20:30+08:00', dest_en: 'Happy Valley', dest_tc: '跑馬地', dest_sc: '', rmk_en: '', rmk_tc: '', rmk_sc: '', data_timestamp: response.generated_timestamp },
    ] });
    renderPage();
    await waitFor(() => expect(screen.getAllByText('中環站')).toHaveLength(2));
    fireEvent.click(screen.getAllByRole('button', { name: /中環站/ })[0]);
    await waitFor(() => expect(screen.getByText('九巴時段')).toBeDefined());
    expect(screen.getByText('20 分')).toBeDefined();
    await act(() => vi.advanceTimersByTimeAsync(300_000));
    expect(screen.getByText('暫未能提供即時到站時間。')).toBeDefined();
    expect(screen.queryByText('15 分')).toBeNull();
  });
});
