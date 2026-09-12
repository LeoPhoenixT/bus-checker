import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { RefreshIndicator } from './RefreshIndicator';

afterEach(cleanup);

describe('RefreshIndicator', () => {
  it('summarises partial failures and keeps retry available', () => {
    const onRefresh = vi.fn();
    render(
      <LanguageProvider>
        <RefreshIndicator
          lastRefreshed={new Date(Date.now() - 130_000)}
          lastAttemptAt={new Date()}
          failedStopCount={1}
          loading={false}
          onRefresh={onRefresh}
        />
      </LanguageProvider>,
    );

    expect(screen.getByText('部分到站時間未能更新', { exact: false })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '刷新巴士資料' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('keeps a recently updated partial failure visually low-key', () => {
    render(
      <LanguageProvider>
        <RefreshIndicator
          lastRefreshed={new Date(Date.now() - 20_000)}
          lastAttemptAt={new Date()}
          failedStopCount={1}
          loading={false}
        />
      </LanguageProvider>,
    );

    const status = screen.getByText(/更新.*重試/);
    expect(status.className).not.toContain('text-amber');
    expect(screen.queryByText('部分到站時間未能更新', { exact: false })).toBeNull();
  });
});
