import { getDistance } from 'geolib';
import type { Stop, StopName } from './types';

export const COLOCATED_STOP_MAX_DISTANCE_M = 15;

function locationKey(stop: Stop): string {
  return `${Number(stop.lat)}|${Number(stop.long)}`;
}

function representativeOrder(a: Stop, b: Stop): number {
  const aNameLength = a.name_en.length + a.name_tc.length;
  const bNameLength = b.name_en.length + b.name_tc.length;
  return aNameLength - bNameLength || a.stop.localeCompare(b.stop);
}

function normalizedNameKeys(stops: Stop[]): Set<string> {
  const keys = new Set<string>();
  for (const stop of stops) {
    for (const name of getStopSearchNames(stop)) {
      for (const [language, value] of [
        ['en', name.name_en],
        ['tc', name.name_tc],
        ['sc', name.name_sc],
      ] as const) {
        const normalized = value.trim().toLocaleUpperCase().replace(/\s+/g, ' ');
        if (normalized) keys.add(`${language}:${normalized}`);
      }
    }
  }
  return keys;
}

function allWithinColocatedDistance(a: Stop[], b: Stop[]): boolean {
  return a.every((aStop) => b.every((bStop) => getDistance(
    { latitude: Number(aStop.lat), longitude: Number(aStop.long) },
    { latitude: Number(bStop.lat), longitude: Number(bStop.long) },
  ) <= COLOCATED_STOP_MAX_DISTANCE_M));
}

function uniqueNames(stops: Stop[]): StopName[] {
  const names = new Map<string, StopName>();
  for (const stop of stops) {
    for (const value of getStopSearchNames(stop)) {
      names.set(`${value.name_en}|${value.name_tc}|${value.name_sc}`, value);
    }
  }
  return [...names.values()];
}

/**
 * KMB sometimes publishes several stop IDs at the same physical location.
 * Present them as one physical stop while retaining every ID for route and ETA lookups.
 */
export function groupStopsByLocation(stops: Stop[]): Stop[] {
  const byLocation = new Map<string, Stop[]>();
  for (const stop of stops) {
    const key = locationKey(stop);
    const group = byLocation.get(key) ?? [];
    group.push(stop);
    byLocation.set(key, group);
  }

  const physicalGroups: Stop[][] = [];
  const physicalGroupsByName = new Map<string, Stop[][]>();
  for (const coordinateGroup of byLocation.values()) {
    const nameKeys = normalizedNameKeys(coordinateGroup);
    const candidates = new Set<Stop[]>();
    for (const nameKey of nameKeys) {
      for (const group of physicalGroupsByName.get(nameKey) ?? []) candidates.add(group);
    }

    const matchingGroup = [...candidates].find((group) =>
      allWithinColocatedDistance(group, coordinateGroup));
    const physicalGroup = matchingGroup ?? [...coordinateGroup];
    if (matchingGroup) matchingGroup.push(...coordinateGroup);
    else physicalGroups.push(physicalGroup);

    for (const nameKey of nameKeys) {
      const groups = physicalGroupsByName.get(nameKey) ?? [];
      if (!groups.includes(physicalGroup)) groups.push(physicalGroup);
      physicalGroupsByName.set(nameKey, groups);
    }
  }

  return physicalGroups.map((group) => {
    const representative = [...group].sort(representativeOrder)[0];
    return {
      ...representative,
      stopIds: [...new Set(group.flatMap(getStopIds))].sort(),
      nameAliases: uniqueNames(group),
    };
  });
}

export function getStopIds(stop: Stop): string[] {
  return stop.stopIds?.length ? stop.stopIds : [stop.stop];
}

export function getStopSearchNames(stop: Stop): StopName[] {
  return stop.nameAliases?.length
    ? stop.nameAliases
    : [{ name_en: stop.name_en, name_tc: stop.name_tc, name_sc: stop.name_sc }];
}
