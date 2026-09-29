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

function renderRow(etas: ETAEntry[]) {
  return render(createElement(LanguageProvider, null, createElement(ETARow, {
    route: '87D', bound: 'O', serviceType: '1', boardingStopId: 'STOP1', boardingSeq: 2, etas,
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
});
