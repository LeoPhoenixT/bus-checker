import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { LocationPrompt } from './LocationPrompt';

function locationError(code: number): GeolocationPositionError {
  return { code, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
}

afterEach(cleanup);

describe('LocationPrompt', () => {
  it.each([2, 3])('can retry a recoverable error (%s) or use route search', (code) => {
    const onRetry = vi.fn();
    render(<LanguageProvider><LocationPrompt loading={false} supported error={locationError(code)} onRetry={onRetry} /></LanguageProvider>);

    fireEvent.click(screen.getByRole('button', { name: '重試定位' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: '搜尋路線' }).getAttribute('href')).toBe('/routes');
  });

  it('explains how to enable permission after denial and offers route search', () => {
    render(<LanguageProvider><LocationPrompt loading={false} supported error={locationError(1)} onRetry={vi.fn()} /></LanguageProvider>);

    expect(screen.getByText(/網站設定中允許此網站存取位置/)).toBeDefined();
    expect(screen.queryByRole('button', { name: '重試定位' })).toBeNull();
    expect(screen.getByRole('link', { name: '搜尋路線' }).getAttribute('href')).toBe('/routes');
  });

  it('offers English route search when the browser lacks geolocation', () => {
    render(<LocationPrompt loading={false} supported={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText('Geolocation not supported')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Search routes' }).getAttribute('href')).toBe('/routes');
  });
});
