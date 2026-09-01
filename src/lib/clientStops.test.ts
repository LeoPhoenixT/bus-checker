import { describe, expect, it, vi } from 'vitest';
import { getCachedStops } from './clientStops';
import { fetchAllStops } from './kmb';
import type { Stop } from './types';

vi.mock('./kmb', () => ({ fetchAllStops: vi.fn() }));

const ta600: Stop = {
  stop: 'BAE4DA32E5043726',
  name_en: 'TAI WAI BBI - SUN CHUI ESTATE (TA600)',
  name_tc: '大圍轉車站 - 新翠邨 (TA600)',
  name_sc: '大围转车站 - 新翠邨 (TA600)',
  lat: 22.370814,
  long: 114.179545,
  data_timestamp: '',
};

const ta601: Stop = {
  ...ta600,
  stop: 'F91B28AE855628AF',
  name_en: 'TAI WAI BBI - SUN CHUI ESTATE (TA601)',
  name_tc: '大圍轉車站 - 新翠邨 (TA601)',
  name_sc: '大围转车站 - 新翠邨 (TA601)',
};

describe('getCachedStops', () => {
  it('keeps identical-coordinate KMB platforms as distinct source records', async () => {
    vi.mocked(fetchAllStops).mockResolvedValue({
      type: 'StopList',
      version: '1.0',
      generated_timestamp: '',
      data: [ta600, ta601],
    });

    await expect(getCachedStops()).resolves.toEqual([ta600, ta601]);
  });
});
