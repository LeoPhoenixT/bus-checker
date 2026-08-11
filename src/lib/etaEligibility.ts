import type { DirectRouteMatch, ETAEntry } from './types';

function normalize(value: unknown): string {
  return String(value ?? '').trim().toUpperCase();
}

export function filterEligibleETAs(
  etas: ETAEntry[],
  matches: DirectRouteMatch[] | undefined,
): ETAEntry[] {
  if (matches === undefined) return etas;

  const allowed = new Set(
    matches.map((match) =>
      `${normalize(match.route)}|${normalize(match.bound)}|${normalize(match.serviceType)}`,
    ),
  );

  return etas.filter((eta) =>
    allowed.has(`${normalize(eta.route)}|${normalize(eta.dir)}|${normalize(eta.service_type)}`),
  );
}
