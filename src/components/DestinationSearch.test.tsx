import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { getCachedStops } from '@/lib/clientStops';
import { DestinationSearch } from './DestinationSearch';
import type { Stop } from '@/lib/types';

vi.mock('@/lib/clientStops', () => ({ getCachedStops: vi.fn() }));

const stop: Stop = {
  stop: 'CENTRAL1', name_en: 'Central Bus Terminus', name_tc: '中環巴士總站',
  name_sc: '中环巴士总站', lat: 22.28, long: 114.16, data_timestamp: '',
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(getCachedStops).mockResolvedValue([stop]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('DestinationSearch', () => {
  it('uses an opaque popover surface for results', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    render(
      <LanguageProvider>
        <DestinationSearch onSelectStop={vi.fn()} onSelectAddress={vi.fn()} />
      </LanguageProvider>,
    );
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Central' } });

    expect(screen.getByRole('listbox').className).toContain('bg-[var(--popover-bg)]');
  });

  it('renders separate stop and address sections and selects either result', async () => {
    const onSelectStop = vi.fn();
    const onSelectAddress = vi.fn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
      results: [{
        id: 'address-1', labelEn: 'Central Market', labelTc: '中環街市',
        lat: 22.285, lon: 114.155,
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    render(
      <LanguageProvider>
        <DestinationSearch onSelectStop={onSelectStop} onSelectAddress={onSelectAddress} />
      </LanguageProvider>,
    );
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Central' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });

    expect(screen.getByText('巴士站')).toBeDefined();
    expect(screen.getByText('一般地址')).toBeDefined();
    await waitFor(() => expect(screen.getByText('中環街市')).toBeDefined());

    fireEvent.click(screen.getByText('中環巴士總站'));
    expect(onSelectStop).toHaveBeenCalledWith(stop);

    fireEvent.focus(screen.getByRole('combobox'));
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    await waitFor(() => expect(screen.getByText('中環街市')).toBeDefined());
    fireEvent.click(screen.getByText('中環街市'));
    expect(onSelectAddress).toHaveBeenCalledWith(expect.objectContaining({ id: 'address-1' }));
  });

  it('shows colocated KMB platforms as separate results', async () => {
    const ta600: Stop = {
      ...stop,
      stop: 'BAE4DA32E5043726',
      name_en: 'TAI WAI BBI - SUN CHUI ESTATE (TA600)',
      name_tc: '大圍轉車站 - 新翠邨 (TA600)',
      name_sc: '大围转车站 - 新翠邨 (TA600)',
      lat: 22.370814,
      long: 114.179545,
    };
    const ta601: Stop = {
      ...ta600,
      stop: 'F91B28AE855628AF',
      name_en: 'TAI WAI BBI - SUN CHUI ESTATE (TA601)',
      name_tc: '大圍轉車站 - 新翠邨 (TA601)',
      name_sc: '大围转车站 - 新翠邨 (TA601)',
    };
    vi.mocked(getCachedStops).mockResolvedValue([ta600, ta601]);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const onSelectStop = vi.fn();

    render(
      <LanguageProvider>
        <DestinationSearch onSelectStop={onSelectStop} onSelectAddress={vi.fn()} />
      </LanguageProvider>,
    );
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '大圍轉車站' } });

    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByText('大圍轉車站 - 新翠邨 (TA600)')).toBeDefined();
    fireEvent.click(screen.getByText('大圍轉車站 - 新翠邨 (TA601)'));
    expect(onSelectStop).toHaveBeenCalledWith(ta601);
  });

  it('returns 大圍轉車站 - 新翠邨新明樓 beyond the old eight-result cutoff', async () => {
    const distractors: Stop[] = Array.from({ length: 12 }, (_, index) => ({
      ...stop,
      stop: `TAIWAI${String(index).padStart(2, '0')}`,
      name_en: `Tai Wai stop ${index}`,
      name_tc: `大圍其他站 ${index}`,
      name_sc: `大围其他站 ${index}`,
    }));
    const taiWaiPlatform: Stop = {
      ...stop,
      stop: '4F09976CA4CF80C9',
      name_en: 'Tai Wai BBI - Sun Ming House, Sun Chui Estate',
      name_tc: '大圍轉車站 - 新翠邨新明樓',
      name_sc: '大围转车站 - 新翠邨新明楼',
    };
    vi.mocked(getCachedStops).mockResolvedValue([...distractors, taiWaiPlatform]);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    render(
      <LanguageProvider>
        <DestinationSearch onSelectStop={vi.fn()} onSelectAddress={vi.fn()} />
      </LanguageProvider>,
    );
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '大圍' } });

    expect(screen.getByText('大圍轉車站 - 新翠邨新明樓')).toBeDefined();
    expect(screen.getByText('4F09976CA4CF80C9')).toBeDefined();
  });
});
