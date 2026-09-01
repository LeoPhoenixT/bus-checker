import { describe, expect, it, vi } from 'vitest';
import { getCachedStops } from './clientStops';
import { fetchAllStops } from './kmb';
import type { Stop } from './types';

vi.mock('./kmb', () => ({ fetchAllStops: vi.fn() }));

const platformA: Stop = {
  stop: 'PLATFORM_A',
  name_en: 'EXAMPLE INTERCHANGE (PLATFORM A)',
  name_tc: '示例轉車站 (月台 A)',
  name_sc: '示例转车站 (月台 A)',
  lat: 22.000001,
  long: 114.000001,
  data_timestamp: '',
};

const platformB: Stop = {
  ...platformA,
  stop: 'PLATFORM_B',
  name_en: 'EXAMPLE INTERCHANGE (PLATFORM B)',
  name_tc: '示例轉車站 (月台 B)',
  name_sc: '示例转车站 (月台 B)',
};

describe('getCachedStops', () => {
  it('keeps identical-coordinate KMB platforms as distinct source records', async () => {
    vi.mocked(fetchAllStops).mockResolvedValue({
      type: 'StopList',
      version: '1.0',
      generated_timestamp: '',
      data: [platformA, platformB],
    });

    await expect(getCachedStops()).resolves.toEqual([platformA, platformB]);
  });
});
