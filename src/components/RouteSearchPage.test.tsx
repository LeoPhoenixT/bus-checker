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

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('RouteSearchPage', () => {
  it('debounces normalized route lookup and renders separate special-service variants', async () => {
    searchRoutesMock.mockResolvedValue([
      {
        route: '87D', bound: 'O', serviceType: '1', originEn: 'Kam Ying Court', originTc: '錦英苑',
        destinationEn: 'Hung Hom Station', destinationTc: '紅磡站', isSpecial: false,
      },
      {
        route: '87D', bound: 'O', serviceType: '3', originEn: 'Ma On Shan Town Centre', originTc: '馬鞍山市中心',
        destinationEn: 'Hung Hom Station', destinationTc: '紅磡站', isSpecial: true,
      },
    ]);
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
    expect(screen.getAllByRole('link', { name: /往 紅磡站/ })[0].getAttribute('href')).toContain('/routes/87D?bound=O&serviceType=1');
  });
});
