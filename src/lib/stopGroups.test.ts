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
    const ta600 = stop({
      stop: 'BAE4DA32E5043726',
      name_en: 'TAI WAI BBI - SUN CHUI ESTATE (TA600)',
      name_tc: '大圍轉車站 - 新翠邨 (TA600)',
      lat: 22.370814,
      long: 114.179545,
    });
    const ta601 = stop({
      stop: 'F91B28AE855628AF',
      name_en: 'TAI WAI BBI - SUN CHUI ESTATE (TA601)',
      name_tc: '大圍轉車站 - 新翠邨 (TA601)',
      lat: 22.370814,
      long: 114.179545,
    });

    expect(getStopIds(ta600)).toEqual(['BAE4DA32E5043726']);
    expect(getStopIds(ta601)).toEqual(['F91B28AE855628AF']);
  });
});
