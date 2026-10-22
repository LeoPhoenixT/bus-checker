import { describe, expect, it } from 'vitest';
import { citybusDataTime } from './citybusEtaTime';
import type { CitybusETAResponse } from './citybusTypes';

describe('Citybus source data age', () => {
  const generated = '2026-10-14T12:00:30+08:00';
  const timestamp = '2026-10-14T12:00:00+08:00';
  const now = Date.parse('2026-10-14T12:01:00+08:00');
  it('uses the older upstream timestamp regardless of when an identical response is fetched', () => {
    const response = { generated_timestamp: generated, data: [{ data_timestamp: timestamp }] } as CitybusETAResponse;
    expect(citybusDataTime(response, now)?.getTime()).toBe(Date.parse(timestamp));
    expect(citybusDataTime(response, now + 120_000)?.getTime()).toBe(Date.parse(timestamp));
  });
  it('ages empty results from generated time and leaves invalid or future source time unknown', () => {
    expect(citybusDataTime({ generated_timestamp: generated, data: [] }, now)?.getTime()).toBe(Date.parse(generated));
    expect(citybusDataTime({ generated_timestamp: '', data: [] }, now)).toBeNull();
    expect(citybusDataTime({ generated_timestamp: '2026-10-15T12:00:00+08:00', data: [] }, now)).toBeNull();
  });
});
