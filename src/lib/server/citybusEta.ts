import type { CitybusBound, CitybusETAEntry, CitybusETAResponse } from '../citybusTypes';
import { CitybusError, createCitybusCache, fetchCitybusJSON, positiveInteger, record, text } from './citybus';
import { fetchCitybusRouteStops } from './citybusRoutes';

const cache = createCitybusCache<CitybusETAResponse>(15_000, 2000);

export async function getCitybusRouteETA(route: string, bound: CitybusBound, stopId: string, seq: number): Promise<CitybusETAResponse> {
  const topology = await fetchCitybusRouteStops(route, bound);
  if (!topology.some((stop) => stop.stopId === stopId && stop.seq === seq)) throw new CitybusError('Boarding stop not found on this route direction', 404);
  const response = await cache.get(`${route}|${stopId}`, async () => {
    const body = await fetchCitybusJSON(`eta/CTB/${stopId}/${encodeURIComponent(route)}`);
    if (!Array.isArray(body.data)) throw new CitybusError('Invalid Citybus ETA response', 502);
    const data = body.data.map((row): CitybusETAEntry => {
      const seq = record(row) ? positiveInteger(row.seq) : null;
      const etaSeq = record(row) ? positiveInteger(row.eta_seq) : null;
      if (!record(row) || row.co !== 'CTB' || row.route !== route || row.stop !== stopId
        || (row.dir !== 'I' && row.dir !== 'O') || seq === null || etaSeq === null
        || !(row.eta === null || typeof row.eta === 'string')
        || (typeof row.eta === 'string' && row.eta.trim() !== '' && !Number.isFinite(Date.parse(row.eta)))) {
        throw new CitybusError('Invalid Citybus ETA row', 502);
      }
      return {
        co: 'CTB', route, dir: row.dir, seq, stop: stopId, eta_seq: etaSeq, eta: text(row.eta) || null,
        dest_en: text(row.dest_en), dest_tc: text(row.dest_tc), dest_sc: text(row.dest_sc),
        rmk_en: text(row.rmk_en), rmk_tc: text(row.rmk_tc), rmk_sc: text(row.rmk_sc), data_timestamp: text(row.data_timestamp),
      };
    });
    return { generated_timestamp: text(body.generated_timestamp), data };
  });
  return { ...response, data: response.data.filter((row) => row.dir === bound && row.seq === seq).sort((a, b) => a.eta_seq - b.eta_seq) };
}

export function resetCitybusEtaCacheForTests() { cache.reset(); }
