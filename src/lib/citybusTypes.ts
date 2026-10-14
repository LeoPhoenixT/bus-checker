import type { ETAEntry, RouteDetailStop, RouteStopOccurrence } from './types';

export interface CitybusRoute {
  operator: 'CTB';
  route: string;
  originEn: string;
  originTc: string;
  destinationEn: string;
  destinationTc: string;
}

export type CitybusBound = 'I' | 'O';

export interface CitybusRouteStop extends RouteStopOccurrence {
  route: string;
  bound: CitybusBound;
}

export type CitybusStopResult =
  | { status: 'resolved'; stop: RouteDetailStop }
  | { status: 'unavailable' | 'missing' | 'invalid'; stopId: string; seq: number };

export interface CitybusRouteDetail {
  variant: CitybusRoute & { bound: CitybusBound };
  stops: CitybusStopResult[];
  directions: { bound: CitybusBound; status: 'available' | 'empty' | 'unavailable' }[];
  retryAfterSeconds?: number;
}

/** Citybus has no KMB service_type. Keep the raw provider identities separate. */
export type CitybusETAEntry = Omit<ETAEntry, 'service_type'>;

export interface CitybusETAResponse {
  generated_timestamp: string;
  data: CitybusETAEntry[];
}
