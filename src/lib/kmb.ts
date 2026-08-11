import type { StopListResponse, StopETAResponse } from './types';

export async function fetchAllStops(): Promise<StopListResponse> {
  const res = await fetch('/api/stops');
  if (!res.ok) throw new Error(`Failed to fetch stops: ${res.status}`);
  return res.json() as Promise<StopListResponse>;
}

export async function fetchStopETAs(stopId: string): Promise<StopETAResponse> {
  const res = await fetch(`/api/stop-eta/${encodeURIComponent(stopId)}`);
  if (!res.ok) throw new Error(`Failed to fetch ETAs for ${stopId}: ${res.status}`);
  return res.json() as Promise<StopETAResponse>;
}
