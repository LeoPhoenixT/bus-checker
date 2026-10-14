import type { CitybusBound, CitybusRoute, CitybusRouteDetail, CitybusRouteStop } from '../citybusTypes';
import { compareRouteLookups } from '../routeSearch';
import { isValidRouteQuery, normalizeRouteQuery } from '../routeVariants';
import { CITYBUS_METADATA_TTL_MS, CitybusError, createCitybusCache, fetchCitybusJSON, isCitybusStopId, positiveInteger, record, text, waitForCitybus } from './citybus';
import { resolveCitybusStops } from './citybusStops';

const routesCache = createCitybusCache<CitybusRoute[]>(CITYBUS_METADATA_TTL_MS, 1);
const topologyCache = createCitybusCache<CitybusRouteStop[]>(CITYBUS_METADATA_TTL_MS, 1000);

export function fetchCitybusRoutes(): Promise<CitybusRoute[]> {
  return routesCache.get('CTB', async () => {
    const { data } = await fetchCitybusJSON('route/CTB');
    if (!Array.isArray(data) || data.length === 0) throw new CitybusError('Invalid Citybus route list', 502);
    const routes = data.map((row): CitybusRoute => {
      if (!record(row)) throw new CitybusError('Invalid Citybus route', 502);
      const route = normalizeRouteQuery(text(row.route));
      const originEn = text(row.orig_en), originTc = text(row.orig_tc);
      const destinationEn = text(row.dest_en), destinationTc = text(row.dest_tc);
      if (row.co !== 'CTB' || !isValidRouteQuery(route) || (!originEn && !originTc) || (!destinationEn && !destinationTc)) {
        throw new CitybusError('Invalid Citybus route', 502);
      }
      return { operator: 'CTB', route, originEn, originTc, destinationEn, destinationTc };
    });
    return [...new Map(routes.map((route) => [route.route, route])).values()];
  });
}

export async function searchCitybusRoutes(query: string, limit = 51): Promise<CitybusRoute[]> {
  return (await fetchCitybusRoutes()).filter((item) => item.route.startsWith(query))
    .sort((a, b) => compareRouteLookups(a, b, query)).slice(0, limit);
}

/** Topology only: ETA validation must never depend on stop-name or coordinate requests. */
export function fetchCitybusRouteStops(route: string, bound: CitybusBound): Promise<CitybusRouteStop[]> {
  if (!isValidRouteQuery(route) || (bound !== 'I' && bound !== 'O')) return Promise.reject(new CitybusError('Invalid Citybus route direction', 400));
  return topologyCache.get(`${route}|${bound}`, async () => {
    const { data } = await fetchCitybusJSON(`route-stop/CTB/${encodeURIComponent(route)}/${bound === 'O' ? 'outbound' : 'inbound'}`);
    if (!Array.isArray(data)) throw new CitybusError('Invalid Citybus route stops', 502);
    const stops = data.map((row): CitybusRouteStop => {
      const seq = record(row) ? positiveInteger(row.seq) : null;
      if (!record(row) || row.co !== 'CTB' || row.route !== route || row.dir !== bound || seq === null || !isCitybusStopId(text(row.stop))) {
        throw new CitybusError('Invalid Citybus route stop', 502);
      }
      return { route, bound, stopId: text(row.stop), seq };
    }).sort((a, b) => a.seq - b.seq);
    if (new Set(stops.map((stop) => stop.seq)).size !== stops.length) throw new CitybusError('Duplicate Citybus stop sequence', 502);
    return stops;
  });
}

export async function getCitybusRouteDetail(route: string, bound?: CitybusBound): Promise<CitybusRouteDetail | null> {
  const deadline = Date.now() + 35_000;
  const signal = AbortSignal.timeout(35_000);
  const item = (await waitForCitybus(fetchCitybusRoutes(), signal)).find((item) => item.route === route);
  if (!item) return null;
  const bounds = ['O', 'I'] as const;
  const topologies = await Promise.allSettled(bounds.map((direction) => waitForCitybus(fetchCitybusRouteStops(route, direction), signal)));
  const directions: CitybusRouteDetail['directions'] = topologies.map((result, index) => ({
    bound: bounds[index], status: result.status === 'rejected' ? 'unavailable' : result.value.length ? 'available' : 'empty',
  }));
  const selectedBound = bound ?? directions.find((item) => item.status === 'available')?.bound;
  if (!selectedBound) {
    const failed = topologies.find((item) => item.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    return null;
  }
  const selected = topologies[bounds.indexOf(selectedBound)];
  if (selected.status === 'rejected') throw selected.reason;
  if (!selected.value.length) return null;
  const variant = selectedBound === 'O' ? { ...item, bound: selectedBound }
    : { ...item, bound: selectedBound, originEn: item.destinationEn, originTc: item.destinationTc, destinationEn: item.originEn, destinationTc: item.originTc };
  const { stops, retryAt: stopsRetryAt } = await resolveCitybusStops(selected.value, Math.max(1, Math.min(20_000, deadline - Date.now())));
  const retryAt = topologies.reduce((latest, result) => result.status === 'rejected'
    ? Math.max(latest, result.reason instanceof CitybusError ? result.reason.retryAt : Date.now() + 30_000) : latest, stopsRetryAt);
  return { variant, directions, stops,
    ...(retryAt ? { retryAfterSeconds: Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)) } : {}),
  };
}

export function resetCitybusRoutesCacheForTests() { routesCache.reset(); topologyCache.reset(); }
