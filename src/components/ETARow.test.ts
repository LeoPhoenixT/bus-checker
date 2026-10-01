import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import type { ETAEntry } from '@/lib/types';
import { getMinutesUntil } from './ETARow';
import { ETARow } from './ETARow';

function eta(overrides: Partial<ETAEntry> = {}): ETAEntry {
  return {
    co: 'KMB', route: '87D', dir: 'O', service_type: '1', seq: 2, stop: 'STOP1',
    dest_en: 'Destination', dest_tc: '目的地', dest_sc: '', eta_seq: 1,
    eta: '2026-09-02T12:10:00.000Z', rmk_en: '', rmk_tc: '', rmk_sc: '', data_timestamp: '',
    ...overrides,
  };
}

function renderRow(etas: ETAEntry[], props: Partial<Parameters<typeof ETARow>[0]> = {}) {
  return render(createElement(LanguageProvider, null, createElement(ETARow, {
    route: '87D', bound: 'O', serviceType: '1', boardingStopId: 'STOP1', boardingSeq: 2, etas, ...props,
  })));
}

describe('getMinutesUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rounds remaining time down to whole minutes', () => {
    expect(getMinutesUntil('2026-09-02T12:02:59.000Z')).toBe(2);
    expect(getMinutesUntil('2026-09-02T12:02:01.000Z')).toBe(2);
    expect(getMinutesUntil('2026-09-02T12:00:59.000Z')).toBe(0);
  });
});

describe('ETARow null ETA display', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('promotes a timed arrival ahead of a null ETA', () => {
    renderRow([eta({ eta: null, rmk_tc: '班次暫停' }), eta({ eta_seq: 2 })]);
    expect(screen.getByText('10 分')).toBeDefined();
    expect(screen.queryByText('班次暫停')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('shows the KMB remark when only null ETAs exist', () => {
    renderRow([eta({ eta: null, rmk_tc: '班次暫停' })]);
    expect(screen.getByText('班次暫停')).toBeDefined();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('keeps two distinct predictions which round down to the same minute', () => {
    renderRow([eta({ eta: '2026-09-02T12:10:05Z' }), eta({ eta_seq: 2, eta: '2026-09-02T12:10:50Z' })]);
    expect(screen.getAllByText('10 分')).toHaveLength(2);
  });

  it('handles optional primary and null ETA remarks omitted by the upstream response', () => {
    const sparse = eta();
    delete (sparse as Partial<ETAEntry>).rmk_tc;
    const { unmount } = renderRow([sparse]);
    expect(screen.getByText('10 分')).toBeDefined();
    unmount();
    renderRow([{ ...sparse, eta: null }]);
    expect(screen.getByText('暫無即時預報')).toBeDefined();
  });

  it('keeps very stale predictions hidden while a refresh is running', () => {
    renderRow([eta(), eta({ eta_seq: 2, eta: '2026-09-02T12:20:00Z' })], {
      freshness: 'very-stale', lastSuccessfulAt: new Date(Date.now() - 301_000), etaLoading: true,
    });
    expect(screen.queryByText('10 分')).toBeNull();
    expect(screen.queryByText('20 分')).toBeNull();
    expect(screen.getByText('暫未能提供')).toBeDefined();
  });

  it('does not leak later predictions during initial loading', () => {
    renderRow([eta(), eta({ eta_seq: 2, eta: '2026-09-02T12:20:00Z' })], { etaLoading: true });
    expect(screen.queryByText('10 分')).toBeNull();
    expect(screen.queryByText('20 分')).toBeNull();
    expect(screen.getByText('正在載入到站時間…')).toBeDefined();
  });
});
