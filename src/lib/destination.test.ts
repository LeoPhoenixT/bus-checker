import { describe, expect, it } from 'vitest';
import { getDestinationCandidates, getDestinationPoint } from './destination';
import type { DestinationSelection, Stop } from './types';

const exactStop: Stop = {
  stop: 'EXACT001', name_en: 'Exact', name_tc: '指定站', name_sc: '指定站',
  lat: 22.3, long: 114.2, data_timestamp: '',
};
const radiusStop = { ...exactStop, stop: 'NEAR0001' };

describe('destination selection', () => {
  it('uses only the selected stop in exact-stop mode', () => {
    const selection: DestinationSelection = { kind: 'stop', stop: exactStop };
    expect(getDestinationCandidates(selection, [radiusStop])).toEqual([exactStop]);
    expect(getDestinationPoint(selection)).toEqual({ lat: 22.3, lon: 114.2 });
  });

  it('keeps radius candidates for address and map points', () => {
    const selection: DestinationSelection = {
      kind: 'point', source: 'address', lat: 22.31, lon: 114.21,
    };
    expect(getDestinationCandidates(selection, [radiusStop])).toEqual([radiusStop]);
    expect(getDestinationPoint(selection)).toEqual({ lat: 22.31, lon: 114.21 });
  });
});
