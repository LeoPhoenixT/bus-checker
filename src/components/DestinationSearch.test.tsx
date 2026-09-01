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
    const platformA: Stop = {
      ...stop,
      stop: 'PLATFORM_A',
      name_en: 'EXAMPLE INTERCHANGE (PLATFORM A)',
      name_tc: '示例轉車站 (月台 A)',
      name_sc: '示例转车站 (月台 A)',
      lat: 22.000001,
      long: 114.000001,
    };
    const platformB: Stop = {
      ...platformA,
      stop: 'PLATFORM_B',
      name_en: 'EXAMPLE INTERCHANGE (PLATFORM B)',
      name_tc: '示例轉車站 (月台 B)',
      name_sc: '示例转车站 (月台 B)',
    };
    vi.mocked(getCachedStops).mockResolvedValue([platformA, platformB]);
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
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '示例轉車站' } });

    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByText('示例轉車站 (月台 A)')).toBeDefined();
    fireEvent.click(screen.getByText('示例轉車站 (月台 B)'));
    expect(onSelectStop).toHaveBeenCalledWith(platformB);
  });

  it('returns a matching stop beyond the old eight-result cutoff', async () => {
    const distractors: Stop[] = Array.from({ length: 12 }, (_, index) => ({
      ...stop,
      stop: `SAMPLE${String(index).padStart(2, '0')}`,
      name_en: `Sample stop ${index}`,
      name_tc: `示例其他站 ${index}`,
      name_sc: `示例其他站 ${index}`,
    }));
    const matchingPlatform: Stop = {
      ...stop,
      stop: 'PLATFORM_TARGET',
      name_en: 'Example Interchange (Platform Target)',
      name_tc: '示例轉車站 (目標月台)',
      name_sc: '示例转车站 (目标月台)',
    };
    vi.mocked(getCachedStops).mockResolvedValue([...distractors, matchingPlatform]);
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
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '示例' } });

    expect(screen.getByText('示例轉車站 (目標月台)')).toBeDefined();
    expect(screen.getByText('PLATFORM_TARGET')).toBeDefined();
  });
});
