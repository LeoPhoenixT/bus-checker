import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { RouteSearchPage } from './RouteSearchPage';

const searchRoutesMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/kmb', () => ({ searchRoutes: searchRoutesMock }));
vi.mock('next/navigation', () => ({ usePathname: () => '/routes' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a>,
}));

function renderPage() {
  return render(
    <ThemeProvider>
      <LanguageProvider><RouteSearchPage /></LanguageProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ routes: [], truncated: false }))));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('RouteSearchPage', () => {
  it('distinguishes same-number operators and preserves the Citybus filter in URLs', async () => {
    searchRoutesMock.mockResolvedValue({ routes: [{
      route: '1', bound: 'O', serviceType: '1', originEn: 'KMB A', originTc: '九巴起點', destinationEn: 'KMB B', destinationTc: '九巴終點', isSpecial: false,
    }], truncated: false });
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ routes: [{
      operator: 'CTB', route: '1', originEn: 'Central', originTc: '中環', destinationEn: 'Happy Valley', destinationTc: '跑馬地',
    }], truncated: false })));
    renderPage();
    fireEvent.change(screen.getByRole('textbox', { name: '搜尋路線號碼' }), { target: { value: '1' } });
    await act(() => vi.advanceTimersByTimeAsync(180));
    await waitFor(() => expect(screen.getByText('往 跑馬地')).toBeDefined());
    expect(screen.getByText('往 九巴終點')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '城巴' }));
    expect(screen.queryByText('往 九巴終點')).toBeNull();
    expect(screen.getByRole('link', { name: /往 跑馬地/ }).getAttribute('href')).toBe('/routes/1?operator=CTB&q=1&filter=CTB');
    expect(window.location.search).toBe('?q=1&operator=CTB');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('debounces normalized route lookup and renders separate special-service variants', async () => {
    searchRoutesMock.mockResolvedValue({ routes: [
      {
        route: '87D', bound: 'O', serviceType: '1', originEn: 'Kam Ying Court', originTc: '錦英苑',
        destinationEn: 'Hung Hom Station', destinationTc: '紅磡站', isSpecial: false,
      },
      {
        route: '87D', bound: 'O', serviceType: '3', originEn: 'Ma On Shan Town Centre', originTc: '馬鞍山市中心',
        destinationEn: 'Hung Hom Station', destinationTc: '紅磡站', isSpecial: true,
      },
    ], truncated: false });
    renderPage();
    const input = screen.getByRole('textbox', { name: '搜尋路線號碼' });
    fireEvent.change(input, { target: { value: ' 87 d ' } });

    expect(searchRoutesMock).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    await waitFor(() => expect(searchRoutesMock).toHaveBeenCalledWith('87D', expect.objectContaining({ signal: expect.anything() })));

    expect(screen.getAllByText('87D')).toHaveLength(2);
    expect(screen.getByText('特別班')).toBeDefined();
    expect(screen.getByText('錦英苑開出')).toBeDefined();
    expect(screen.getByText('馬鞍山市中心開出')).toBeDefined();
    expect(screen.getAllByRole('link', { name: /往 紅磡站/ })[0].getAttribute('href')).toContain('/routes/87D?bound=O&serviceType=1&q=87D');
  });

  it('retries a failed search and explains when results are capped', async () => {
    searchRoutesMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ routes: [{
        route: '1', bound: 'O', serviceType: '1', originEn: 'A', originTc: '甲', destinationEn: 'B', destinationTc: '乙', isSpecial: false,
      }], truncated: true });
    renderPage();
    fireEvent.change(screen.getByRole('textbox', { name: '搜尋路線號碼' }), { target: { value: '1' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    await waitFor(() => expect(screen.getByText('暫時無法搜尋路線。')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: '重試' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    await waitFor(() => expect(screen.getByText('只顯示首 50 個結果，請輸入更多字元縮小搜尋範圍。')).toBeDefined());
    expect(searchRoutesMock).toHaveBeenCalledTimes(2);
  });

  it('restores a valid query supplied by the route-search URL', async () => {
    searchRoutesMock.mockResolvedValue({ routes: [], truncated: false });
    render(
      <ThemeProvider><LanguageProvider><RouteSearchPage initialQuery=" b1 " /></LanguageProvider></ThemeProvider>,
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(180); });
    expect((screen.getByRole('textbox', { name: '搜尋路線號碼' }) as HTMLInputElement).value).toBe('B1');
    expect(searchRoutesMock).toHaveBeenCalledWith('B1', expect.objectContaining({ signal: expect.anything() }));
  });
});
