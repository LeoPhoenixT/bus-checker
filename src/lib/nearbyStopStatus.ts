import type { StopETAStateWithFreshness } from '@/hooks/useStopETAs';
import type { ETAFreshness } from './etaFreshness';
import { getStopIds } from './stopGroups';
import type { DirectRouteMatch, ETAEntry, Stop } from './types';

const freshnessPriority: Record<ETAFreshness, number> = {
  fresh: 0,
  'slightly-old': 1,
  stale: 2,
  'very-stale': 3,
  unavailable: 4,
};

export function getNearbyStopETAStatus(stop: Stop, etaStates: Record<string, StopETAStateWithFreshness>) {
  const states = getStopIds(stop)
    .map((stopId) => etaStates[stopId.trim().toUpperCase()])
    .filter((state): state is StopETAStateWithFreshness => Boolean(state));
  const successful = states.filter((state) => state.lastSuccessfulAt !== null);
  const freshness = successful.length === 0 && states.length > 0
    ? 'unavailable'
    : successful.reduce<ETAFreshness>((leastFresh, state) => (
      freshnessPriority[state.freshness] > freshnessPriority[leastFresh] ? state.freshness : leastFresh
    ), 'fresh');
  const lastSuccessfulAt = successful.reduce<Date | null>((oldest, { lastSuccessfulAt: date }) => (
    date && (!oldest || date < oldest) ? date : oldest
  ), null);
  const loading = states.some((state) => state.attemptStatus === 'loading' && state.lastSuccessfulAt === null);
  const hasProblem = (successful.length === 0 && states.length > 0 && !loading) || freshness === 'very-stale'
    || states.some((state) => state.attemptStatus === 'error');

  return { freshness, lastSuccessfulAt, loading, hasProblem };
}

export function matchesNearbyRouteFilter(
  filters: string[],
  etas: ETAEntry[],
  destinationMatches?: DirectRouteMatch[],
): boolean {
  if (!filters.length) return true;
  const matchesNumber = (route: string) => filters.some((filter) => route.trim().toUpperCase().includes(filter));

  // Destination results already identify all eligible boarding routes, including
  // routes for which the operator has not returned a prediction.
  if (destinationMatches) return destinationMatches.some(({ route }) => matchesNumber(route));
  return etas.some(({ route, stop, seq }) => Boolean(stop?.trim())
    && Number.isSafeInteger(seq) && seq > 0 && matchesNumber(route));
}

export function showNearbyStopCard(
  matchesFilter: boolean,
  destinationActive: boolean,
  status: Pick<ReturnType<typeof getNearbyStopETAStatus>, 'loading' | 'hasProblem'>,
): boolean {
  return matchesFilter || (!destinationActive && (status.loading || status.hasProblem));
}

export function nearbyStopAnchor(stopId: string): string {
  return `nearby-stop-${stopId}`;
}
