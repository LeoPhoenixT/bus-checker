'use client';

import { useEffect, useRef } from 'react';
import { addOpenStreetMapTiles, loadLeaflet } from '@/lib/leaflet';
import type { Lang, RouteDetailStop } from '@/lib/types';

interface RouteMapProps {
  stops: RouteDetailStop[];
  selectedStopId: string | null;
  onSelectStop: (stopId: string) => void;
  lang: Lang;
}

function validStops(stops: RouteDetailStop[]): RouteDetailStop[] {
  return stops.filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.long)
    && stop.lat >= -90 && stop.lat <= 90 && stop.long >= -180 && stop.long <= 180);
}

export function RouteMap({ stops, selectedStopId, onSelectStop, lang }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<Map<string, import('leaflet').CircleMarker>>(new Map());
  const onSelectRef = useRef(onSelectStop);
  const selectedRef = useRef(selectedStopId);
  onSelectRef.current = onSelectStop;
  selectedRef.current = selectedStopId;

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
      points.forEach((stop) => {
        const marker = L.circleMarker([stop.lat, stop.long], {
          radius: selectedRef.current === stop.stopId ? 11 : 8,
          color: '#ffffff', weight: 2,
          fillColor: selectedRef.current === stop.stopId ? '#2563eb' : '#dc2626', fillOpacity: 1,
        }).addTo(map!);
        marker.bindTooltip(`${stop.seq}. ${lang === 'en' ? stop.nameEn || stop.nameTc : stop.nameTc || stop.nameEn}`);
        marker.on('click', () => onSelectRef.current(stop.stopId));
        markersRef.current.set(stop.stopId, marker);
      });
      map.fitBounds(L.latLngBounds(coordinates), { padding: [24, 24], maxZoom: 16 });
      const selectedMarker = selectedRef.current ? markersRef.current.get(selectedRef.current) : undefined;
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
      markersRef.current.clear();
    };
  }, [stops, lang]);

  useEffect(() => {
    markersRef.current.forEach((marker, stopId) => {
      const selected = stopId === selectedStopId;
      marker.setStyle({ radius: selected ? 11 : 8, fillColor: selected ? '#2563eb' : '#dc2626' });
      if (selected) {
        marker.bringToFront();
        mapRef.current?.panTo(marker.getLatLng(), { animate: true });
      }
    });
  }, [selectedStopId, stops, lang]);

  if (validStops(stops).length === 0) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm" aria-label={lang === 'en' ? 'Route map' : '路線地圖'}>
      <div ref={containerRef} className="h-96 w-full sm:h-[28rem]" role="img" aria-label={lang === 'en' ? 'Map of route stops' : '路線車站地圖'} />
      <p className="border-t border-[var(--divider)] px-4 py-2 text-xs text-[var(--muted)]">
        {lang === 'en' ? 'Tap a stop on the map to see arrivals. The line connects stops and does not show the exact driving path.' : '點選地圖上的車站查看到站時間。連線僅按站序繪製，並非實際行車路線。'}
      </p>
    </section>
  );
}
