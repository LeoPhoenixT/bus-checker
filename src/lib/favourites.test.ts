import { describe, expect, it } from 'vitest';
import {
  dedupeFavouriteRouteStops,
  favouriteRouteStopKey,
  normalizeFavouriteRouteStop,
  parseStoredFavourites,
  serializeFavourites,
} from './favourites';
import type { FavouriteRouteStop } from './types';

const favourite = { route: ' 87d ', bound: 'o', serviceType: '03', stopId: ' stop-1 ' } as unknown as FavouriteRouteStop;

describe('route-stop favourite identity', () => {
  it('preserves old v2 entries and distinct sequence-specific favourites together', () => {
    const legacy = normalizeFavouriteRouteStop(favourite)!;
    const items = [legacy, { ...legacy, boardingSeq: 2 }, { ...legacy, boardingSeq: 23 }];
    expect(parseStoredFavourites(serializeFavourites(items))).toEqual(items);
    expect(new Set(items.map(favouriteRouteStopKey)).size).toBe(3);
    expect(normalizeFavouriteRouteStop({ ...legacy, boardingSeq: 0 })).toBeNull();
  });
  it('normalizes and keys every field needed to identify a boarding point', () => {
    const normalized = normalizeFavouriteRouteStop(favourite);
    expect(normalized).toEqual({ route: '87D', bound: 'O', serviceType: '3', stopId: 'STOP-1' });
    expect(favouriteRouteStopKey(normalized!)).toBe('87D|O|3|STOP-1');
  });

  it('deduplicates only equal route, direction, service type and stop identities', () => {
    const items = dedupeFavouriteRouteStops([
      favourite,
      { ...favourite, route: '87D', bound: 'O', stopId: 'STOP-1' },
      { ...favourite, stopId: 'STOP-2' },
      { ...favourite, serviceType: '1' },
    ]);
    expect(items).toHaveLength(3);
  });

  it('persists a versioned normalized v2 envelope and rejects an old shape', () => {
    const serialized = serializeFavourites([favourite]);
    expect(parseStoredFavourites(serialized)).toEqual([{ route: '87D', bound: 'O', serviceType: '3', stopId: 'STOP-1' }]);
    expect(parseStoredFavourites(JSON.stringify(['87D']))).toEqual([]);
  });
});
