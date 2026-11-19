'use client';

import { useEffect, useRef } from 'react';
import { X, MapPin } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { addOpenStreetMapTiles, createRedMarkerIcon, loadLeaflet } from '@/lib/leaflet';
import { MapDialog } from './MapDialog';
import type { Stop } from '@/lib/types';

interface StopLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  stop: Stop;
}

export function StopLocationModal({ isOpen, ...props }: StopLocationModalProps) {
  return isOpen ? <StopLocationPreview {...props} /> : null;
}

function StopLocationPreview({ onClose, stop }: Omit<StopLocationModalProps, 'isOpen'>) {
  const { lang } = useLang();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const stopName = lang === 'en' ? stop.name_en : stop.name_tc;

  // Initialise Leaflet map (client-side only — Leaflet requires window)
  useEffect(() => {
    let cancelled = false;
    let map: import('leaflet').Map | undefined;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;

    loadLeaflet().then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      const previewMap = L.map(mapContainerRef.current, {
        center: [Number(stop.lat), Number(stop.long)],
        zoom: 17,
        zoomControl: true,
      });

      addOpenStreetMapTiles(L, previewMap);

      // Red marker at stop location
      const stopIcon = createRedMarkerIcon(L);

      L.marker([Number(stop.lat), Number(stop.long)], { icon: stopIcon }).addTo(previewMap);
      map = previewMap;

      // Trigger resize in case modal animates in
      resizeTimer = setTimeout(() => previewMap.invalidateSize(), 150);
    });

    return () => {
      cancelled = true;
      clearTimeout(resizeTimer);
      map?.remove();
    };
  }, [stop.lat, stop.long]);

  return (
    <MapDialog label={lang === 'en' ? `Bus stop location: ${stopName}` : `巴士站位置：${stopName}`} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--divider)] px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 text-red-500 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--foreground)] truncate">
              {stopName}
            </h2>
            <p className="text-xs text-[var(--muted)] font-mono">{stop.stop}</p>
          </div>
        </div>
        <button
          type="button"
          data-dialog-initial-focus
          onClick={onClose}
          aria-label={lang === 'en' ? 'Close' : '關閉'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--card-border)] focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Map */}
      <div className="relative">
        <div ref={mapContainerRef} className="h-72 sm:h-96 w-full" />
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--divider)] px-4 py-3">
        <p className="text-xs text-[var(--muted)]">
          {Number(stop.lat).toFixed(5)}, {Number(stop.long).toFixed(5)}
        </p>
      </div>
    </MapDialog>
  );
}
