import { describe, expect, it } from 'vitest';
import { getStopIds, getStopSearchNames, groupStopsByLocation } from './stopGroups';
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

describe('groupStopsByLocation', () => {
  it('merges exact colocated entries while retaining all IDs and searchable names', () => {
    const grouped = groupStopsByLocation([
      stop({ stop: 'STOP0002', name_en: 'Ocean Park (WCH01)' }),
      stop({ stop: 'STOP0001' }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].stop).toBe('STOP0001');
    expect(getStopIds(grouped[0])).toEqual(['STOP0001', 'STOP0002']);
    expect(getStopSearchNames(grouped[0]).map((name) => name.name_en)).toEqual([
      'Ocean Park (WCH01)',
      'Ocean Park',
    ]);
  });

  it('merges same-name entries across the 14.4 m Tai Wai interchange spread', () => {
    const grouped = groupStopsByLocation([
      stop({ stop: '4F09976CA4CF80C9', lat: 22.372094, long: 114.180196 }),
      stop({ stop: '9ADE07CC443E4ACE', lat: 22.372053, long: 114.180134 }),
      stop({ stop: 'A004B076CFBD733C', lat: 22.372122, long: 114.180252 }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(getStopIds(grouped[0])).toHaveLength(3);
  });

  it('does not merge nearby entries with different names or same-name entries over 15 m apart', () => {
    const grouped = groupStopsByLocation([
      stop({ stop: 'STOP0001' }),
      stop({
        stop: 'STOP0002',
        name_en: 'Another Stop',
        name_tc: '另一個站',
        name_sc: '另一个站',
        lat: 22.246719,
      }),
      stop({ stop: 'STOP0003', lat: 22.246918 }),
    ]);

    expect(grouped).toHaveLength(3);
  });

  it('handles a full-size list of uniquely named stops without global pair scanning', () => {
    const stops = Array.from({ length: 6_740 }, (_, index) => stop({
      stop: `STOP${String(index).padStart(8, '0')}`,
      name_en: `Stop ${index}`,
      name_tc: `巴士站 ${index}`,
      name_sc: `巴士站 ${index}`,
      lat: 22 + index / 1_000_000,
      long: 114 + index / 1_000_000,
    }));

    expect(groupStopsByLocation(stops)).toHaveLength(stops.length);
  });
});
