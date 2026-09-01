import { describe, expect, it } from 'vitest';
import { getStopIds } from './stopGroups';
import type { Stop } from './types';

function stop(overrides: Partial<Stop>): Stop {
  return {
    stop: 'STOP0001',
    name_en: 'Ocean Park',
    name_tc: '海洋公園',
    name_sc: '海洋公园',
    lat: 22.246718,
    long: 114.173849,
    data_timestamp: '',
    ...overrides,
  };
}

describe('getStopIds', () => {
  it('preserves each KMB source stop ID, even for identical coordinates', () => {
    const platformA = stop({
      stop: 'PLATFORM_A',
      name_en: 'EXAMPLE INTERCHANGE (PLATFORM A)',
      name_tc: '示例轉車站 (月台 A)',
      lat: 22.000001,
      long: 114.000001,
    });
    const platformB = stop({
      stop: 'PLATFORM_B',
      name_en: 'EXAMPLE INTERCHANGE (PLATFORM B)',
      name_tc: '示例轉車站 (月台 B)',
      lat: 22.000001,
      long: 114.000001,
    });

    expect(getStopIds(platformA)).toEqual(['PLATFORM_A']);
    expect(getStopIds(platformB)).toEqual(['PLATFORM_B']);
  });
});
