'use client';

import { useEffect, useRef } from 'react';
import { X, MapPin } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { addOpenStreetMapTiles, createRedMarkerIcon, loadLeaflet } from '@/lib/leaflet';
import type { NearbyStop } from '@/lib/types';

interface StopLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  stop: NearbyStop;
}

// Leaflet types (loaded dynamically, not at module level)
type LeafletMap = import('leaflet').Map;

export function StopLocationModal({ isOpen, onClose, stop }: StopLocationModalProps) {
  const { lang } = useLang();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const stopName = lang === 'en' ? stop.name_en : stop.name_tc;

  // Initialise Leaflet map (client-side only — Leaflet requires window)
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;
    if (mapRef.current) return; // already initialised

    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [Number(stop.lat), Number(stop.long)],
        zoom: 17,
        zoomControl: true,
      });

      addOpenStreetMapTiles(L, map);

      // Red marker at stop location
      const stopIcon = createRedMarkerIcon(L);

      L.marker([Number(stop.lat), Number(stop.long)], { icon: stopIcon }).addTo(map);

      mapRef.current = map;

      // Trigger resize in case modal animates in
      setTimeout(() => map.invalidateSize(), 150);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, stop.lat, stop.long]);

  // Destroy map when modal closes so it re-initialises fresh next open
  useEffect(() => {
    if (!isOpen && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'en' ? `Bus stop location: ${stopName}` : `巴士站位置：${stopName}`}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl overflow-hidden">
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
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close' : '關閉'}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--card-border)] transition shrink-0"
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
      </div>
    </div>
  );
}
