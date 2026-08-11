import { describe, expect, it } from 'vitest';
import { matchDirectRoutes } from './directRouteMatcher';
import type { RouteStop } from './types';

function occurrence(
  stop: string,
  seq: number,
  options: Partial<RouteStop> = {},
): RouteStop {
  return {
    route: '88X',
    bound: 'O',
    service_type: '1',
    seq,
    stop,
    data_timestamp: '',
    ...options,
  };
}

describe('matchDirectRoutes', () => {
  it('matches the same variant only when the destination is later', () => {
    const routeStops = [occurrence('ORIGIN01', 5), occurrence('DEST0001', 18)];
    expect(matchDirectRoutes(routeStops, ['ORIGIN01'], ['DEST0001'])).toEqual({
      ORIGIN01: [{
        route: '88X',
        bound: 'O',
        serviceType: '1',
        boardingSeq: 5,
        alightingStop: 'DEST0001',
        alightingSeq: 18,
      }],
    });
    expect(matchDirectRoutes(routeStops, ['DEST0001'], ['ORIGIN01'])).toEqual({});
  });

  it('rejects the same sequence, opposite bound, and different service type', () => {
    expect(matchDirectRoutes(
      [
        occurrence('ORIGIN01', 5),
        occurrence('DEST0001', 5),
        occurrence('DEST0001', 8, { bound: 'I' }),
        occurrence('DEST0001', 9, { service_type: '2' }),
      ],
      ['ORIGIN01'],
      ['DEST0001'],
    )).toEqual({});
  });

  it('handles repeated stops and selects a deterministic valid pair', () => {
    const result = matchDirectRoutes(
      [
        occurrence('ORIGIN01', 2),
        occurrence('ORIGIN01', 7),
        occurrence('DEST0002', 12),
        occurrence('DEST0001', 12),
        occurrence('DEST0003', 20),
      ],
      ['ORIGIN01'],
      ['DEST0003', 'DEST0002', 'DEST0001'],
    );
    expect(result.ORIGIN01[0]).toMatchObject({
      boardingSeq: 7,
      alightingStop: 'DEST0001',
      alightingSeq: 12,
    });
  });

  it('matches a circular journey when the same stop occurs again later', () => {
    const result = matchDirectRoutes(
      [occurrence('LOOPSTOP', 1), occurrence('MIDSTOP1', 5), occurrence('LOOPSTOP', 10)],
      ['LOOPSTOP'],
      ['LOOPSTOP'],
    );

    expect(result.LOOPSTOP[0]).toMatchObject({
      boardingSeq: 1,
      alightingStop: 'LOOPSTOP',
      alightingSeq: 10,
    });
  });

  it('rejects a zero-length circular journey with only one stop occurrence', () => {
    expect(matchDirectRoutes(
      [occurrence('LOOPSTOP', 1), occurrence('MIDSTOP1', 5)],
      ['LOOPSTOP'],
      ['LOOPSTOP'],
    )).toEqual({});
  });

  it('normalizes duplicate mixed-case IDs and sorts variants stably', () => {
    const result = matchDirectRoutes(
      [
        occurrence('origin01', 1, { route: 'b2', bound: 'I' }),
        occurrence('dest0001', 2, { route: 'B2', bound: 'I' }),
        occurrence('ORIGIN01', 1, { route: 'A1' }),
        occurrence('DEST0001', 2, { route: 'a1' }),
      ],
      ['origin01', 'ORIGIN01'],
      ['dest0001', 'DEST0001'],
    );
    expect(Object.keys(result)).toEqual(['ORIGIN01']);
    expect(result.ORIGIN01.map((match) => match.route)).toEqual(['A1', 'B2']);
  });
});
