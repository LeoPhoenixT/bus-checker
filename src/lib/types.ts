export type Lang = 'en' | 'tc';

export interface Stop {
  stop: string;
  name_en: string;
  name_tc: string;
  name_sc: string;
  lat: number;
  long: number;
  data_timestamp: string;
}

export interface NearbyStop extends Stop {
  distanceM: number;
}

export interface ETAEntry {
  co: string;
  route: string;
  dir: 'I' | 'O';
  service_type: string | number;
  seq: number;
  stop: string;
  dest_en: string;
  dest_tc: string;
  dest_sc: string;
  eta_seq: number;
  eta: string | null;
  rmk_en: string;
  rmk_tc: string;
  rmk_sc: string;
  data_timestamp: string;
}

export interface StopETAResponse {
  type: string;
  version: string;
  generated_timestamp: string;
  data: ETAEntry[];
}

export interface StopListResponse {
  type: string;
  version: string;
  generated_timestamp: string;
  data: Stop[];
}

export interface RouteStop {
  route: string;
  bound: 'I' | 'O';
  service_type: string;
  seq: number;
  stop: string;
  data_timestamp: string;
}

/** A KMB route variant is only unique together with its direction and service type. */
export interface RouteVariantId {
  route: string;
  bound: 'I' | 'O';
  serviceType: string;
}

export interface RouteVariant extends RouteVariantId {
  originEn: string;
  originTc: string;
  destinationEn: string;
  destinationTc: string;
  isSpecial: boolean;
}

export interface RouteDetailStop {
  stopId: string;
  seq: number;
  nameEn: string;
  nameTc: string;
  lat: number;
  long: number;
}

export interface RouteDetail {
  variant: RouteVariant;
  stops: RouteDetailStop[];
  reverseVariants: RouteVariant[];
}

export interface RouteSearchResult {
  routes: RouteVariant[];
  truncated: boolean;
}

export interface DirectRouteMatch {
  route: string;
  bound: 'I' | 'O';
  serviceType: string;
  boardingSeq: number;
  alightingStop: string;
  alightingSeq: number;
}

export type DirectRouteMatchesByOriginStop = Record<string, DirectRouteMatch[]>;
export type DestinationStopNames = Record<string, { en: string; tc: string }>;

export interface AddressSearchResult {
  id: string;
  labelEn: string;
  labelTc: string;
  lat: number;
  lon: number;
}

export type DestinationSelection =
  | { kind: 'stop'; stop: Stop }
  | {
      kind: 'point';
      source: 'address' | 'map';
      lat: number;
      lon: number;
      label?: string;
    };
