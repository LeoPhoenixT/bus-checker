'use client';

import { useEffect, useMemo, useRef } from 'react';
import { addOpenStreetMapTiles, loadLeaflet } from '@/lib/leaflet';
import type { Lang, RouteDetailStop, RouteStopOccurrence } from '@/lib/types';
import { routeStopOccurrenceKey } from '@/lib/routeStopOccurrence';

interface RouteMapProps {
  stops: RouteDetailStop[];
  selectedStopKey: string | null;
  onSelectStop: (stop: RouteStopOccurrence) => void;
  lang: Lang;
}

function validStops(stops: RouteDetailStop[]): RouteDetailStop[] {
  return stops.filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.long)
    && stop.lat >= -90 && stop.lat <= 90 && stop.long >= -180 && stop.long <= 180);
}

function groupStops(stops: RouteDetailStop[]) {
  const groups = new Map<string, RouteDetailStop[]>();
  for (const stop of validStops(stops)) {
    const key = `${stop.lat},${stop.long}`;
    const group = groups.get(key) ?? [];
    if (!group.some((item) => routeStopOccurrenceKey(item) === routeStopOccurrenceKey(stop))) group.push(stop);
    groups.set(key, group);
  }
  return groups;
}

function stopName(stop: RouteDetailStop, lang: Lang): string {
  return lang === 'en' ? stop.nameEn || stop.nameTc : stop.nameTc || stop.nameEn;
}

function orderOccurrencesAtLocation(stops: RouteDetailStop[]): RouteDetailStop[] {
  const byStopId = new Map<string, RouteDetailStop[]>();
  for (const stop of stops) {
    const key = stop.stopId.trim().toUpperCase();
    byStopId.set(key, [...(byStopId.get(key) ?? []), stop]);
  }
  return [...byStopId.values()]
    .sort((a, b) => Math.min(...a.map((stop) => stop.seq)) - Math.min(...b.map((stop) => stop.seq)))
    .flatMap((occurrences) => occurrences.sort((a, b) => a.seq - b.seq));
}

export function RouteMap({ stops, selectedStopKey, onSelectStop, lang }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<Array<{ marker: import('leaflet').CircleMarker; stopKeys: string[] }>>([]);
  const onSelectRef = useRef(onSelectStop);
  const selectedRef = useRef(selectedStopKey);
  const groups = useMemo(() => groupStops(stops), [stops]);
  onSelectRef.current = onSelectStop;
  selectedRef.current = selectedStopKey;

  useEffect(() => {
    const points = validStops(stops);
    if (!containerRef.current || points.length === 0) return;
    let cancelled = false;
    let map: import('leaflet').Map | null = null;

    void loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current) return;
      map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false });
      mapRef.current = map;
      addOpenStreetMapTiles(L, map);
      const coordinates = points.map((stop) => [stop.lat, stop.long] as [number, number]);
      if (coordinates.length > 1) {
        L.polyline(coordinates, { color: '#ffffff', weight: 8, opacity: 0.9, interactive: false }).addTo(map);
        L.polyline(coordinates, { color: '#dc2626', weight: 5, opacity: 0.95, interactive: false }).addTo(map);
      }
      const coordinateGroups = [...groups.values()];
      const makeChoices = (candidateGroups: RouteDetailStop[][], close: () => void, nearby = false) => {
        const candidates = candidateGroups.flatMap(orderOccurrencesAtLocation);
        const choices = document.createElement('div');
        choices.setAttribute('role', 'group');
        choices.setAttribute('aria-label', nearby
          ? (lang === 'en' ? 'Choose a nearby route stop' : '選擇附近站序')
          : (lang === 'en' ? 'Choose a stop at this location' : '選擇此位置的站牌'));
        const heading = document.createElement('p');
        heading.className = 'mb-2 font-semibold';
        heading.textContent = lang === 'en' ? `Choose a route stop (${candidates.length})` : `選擇站序（共 ${candidates.length} 項）`;
        choices.appendChild(heading);
        if (candidates.length > 4) {
          const hint = document.createElement('p');
          hint.className = 'mb-2 text-xs text-gray-600';
          hint.textContent = lang === 'en' ? 'Scroll for more stops' : '向下滑動查看更多';
          choices.appendChild(hint);
        }
        const list = document.createElement('div');
        list.className = 'max-h-56 overflow-y-auto';
        for (const stop of candidates) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'mb-1 block min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-left hover:bg-blue-50';
          button.textContent = `${stop.seq}. ${stopName(stop, lang)}`;
          button.addEventListener('click', () => {
            close();
            onSelectRef.current({ stopId: stop.stopId, seq: stop.seq });
          });
          list.appendChild(button);
        }
        choices.appendChild(list);
        return choices;
      };
      groups.forEach((group) => {
        const selected = group.some((stop) => routeStopOccurrenceKey(stop) === selectedRef.current);
        const marker = L.circleMarker([group[0].lat, group[0].long], {
          radius: selected ? 11 : group.length > 1 ? 10 : 8,
          color: '#ffffff', weight: 2,
          fillColor: selected ? '#2563eb' : '#dc2626', fillOpacity: 1,
        }).addTo(map!);
        const tooltip = document.createElement('span');
        tooltip.textContent = group.length === 1
          ? `${group[0].seq}. ${stopName(group[0], lang)}`
          : lang === 'en' ? `${group.length} route stop entries at this location` : `此位置有 ${group.length} 個站序`;
        marker.bindTooltip(tooltip);
        if (group.length === 1) marker.on('click', (event: import('leaflet').LeafletMouseEvent) => {
          // At route overview zoom, a single SVG marker may cover the centre
          // of a nearby multi-occurrence marker on a phone. Offer that group's
          // exact occurrences alongside the marker that received the tap.
          if (window.innerWidth <= 640) {
            const tap = event?.containerPoint ?? map!.latLngToContainerPoint([group[0].lat, group[0].long]);
            const nearbyRepeated = coordinateGroups.filter((other) => other.length > 1).map((other) => {
              const point = map!.latLngToContainerPoint([other[0].lat, other[0].long]);
              return { stops: other, distance: Math.hypot(point.x - tap.x, point.y - tap.y) };
            }).filter((item) => item.distance <= 22).sort((a, b) => a.distance - b.distance);
            if (nearbyRepeated.length > 0) {
              const popup = L.popup({ autoPan: true });
              popup.setLatLng(marker.getLatLng()).setContent(makeChoices([...nearbyRepeated.map((item) => item.stops), [group[0]]], () => map!.closePopup(), true)).openOn(map!);
              return;
            }
          }
          onSelectRef.current({ stopId: group[0].stopId, seq: group[0].seq });
        });
        else {
          marker.bindPopup(makeChoices([group], () => marker.closePopup()));
        }
        markersRef.current.push({ marker, stopKeys: group.map(routeStopOccurrenceKey) });
      });
      map.fitBounds(L.latLngBounds(coordinates), { padding: [24, 24], maxZoom: 16 });
      const selectedMarker = markersRef.current.find(({ stopKeys }) => selectedRef.current && stopKeys.includes(selectedRef.current))?.marker;
      if (selectedMarker) {
        selectedMarker.bringToFront();
        map.panTo(selectedMarker.getLatLng(), { animate: false });
      }
      requestAnimationFrame(() => map?.invalidateSize());
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [stops, groups, lang]);

  useEffect(() => {
    markersRef.current.forEach(({ marker, stopKeys }) => {
      const selected = selectedStopKey !== null && stopKeys.includes(selectedStopKey);
      marker.setStyle({ radius: selected ? 11 : stopKeys.length > 1 ? 10 : 8, fillColor: selected ? '#2563eb' : '#dc2626' });
      if (selected) {
        marker.bringToFront();
        mapRef.current?.panTo(marker.getLatLng(), { animate: true });
      }
    });
  }, [selectedStopKey, groups, lang]);

  if (groups.size === 0) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm" aria-label={lang === 'en' ? 'Route map' : '路線地圖'}>
      <div ref={containerRef} className="h-96 w-full sm:h-[28rem]" role="region" aria-label={lang === 'en' ? 'Map of route stops' : '路線車站地圖'} />
      <p className="border-t border-[var(--divider)] px-4 py-2 text-xs text-[var(--muted)]">
        {lang === 'en' ? 'Tap a marker to see arrivals or choose between route stops at the same location. The line connects stops and does not show the exact driving path.' : '點選地圖標記查看到站時間；同一位置有多個站序時可再選擇。連線僅按站序繪製，並非實際行車路線。'}
      </p>
    </section>
  );
}
