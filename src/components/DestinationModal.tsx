'use client';

import { useEffect, useRef, useState } from 'react';
import { X, MapPin } from 'lucide-react';
import clsx from 'clsx';
import { RADIUS_PRESETS } from '@/config';
import { DestinationSearch } from './DestinationSearch';
import type { AddressSearchResult, DestinationSelection, Stop } from '@/lib/types';

interface DestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selection: DestinationSelection) => void;
  userLat: number | null;
  userLon: number | null;
  destinationRadius: number;
  onChangeRadius: (r: number) => void;
}

// Leaflet types (loaded dynamically, not at module level)
type LeafletMap = import('leaflet').Map;
type LeafletMarker = import('leaflet').Marker;
type LeafletIcon = import('leaflet').Icon;

export function DestinationModal({
  isOpen,
  onClose,
  onConfirm,
  userLat,
  userLon,
  destinationRadius,
  onChangeRadius,
}: DestinationModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const destinationIconRef = useRef<LeafletIcon | null>(null);
  const [selection, setSelection] = useState<DestinationSelection | null>(null);

  const placeSelection = (nextSelection: DestinationSelection) => {
    setSelection(nextSelection);
    const lat = nextSelection.kind === 'stop' ? Number(nextSelection.stop.lat) : nextSelection.lat;
    const lon = nextSelection.kind === 'stop' ? Number(nextSelection.stop.long) : nextSelection.lon;
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([lat, lon], 17);
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else if (destinationIconRef.current) {
      void import('leaflet').then((L) => {
        if (mapRef.current && destinationIconRef.current) {
          markerRef.current = L.marker([lat, lon], { icon: destinationIconRef.current }).addTo(mapRef.current);
        }
      });
    }
  };

  // Initialise Leaflet map (client-side only — Leaflet requires window)
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;
    if (mapRef.current) return; // already initialised

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      // Fix default marker icon broken by bundlers
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Default centre: user location or Hong Kong
      const centerLat = userLat ?? 22.3193;
      const centerLon = userLon ?? 114.1694;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLon],
        zoom: 16,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Blue marker at user's location
      if (userLat != null && userLon != null) {
        const userIcon = L.divIcon({
          html: '<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 2px #3b82f6;"></div>',
          className: '',
          iconAnchor: [7, 7],
        });
        L.marker([userLat, userLon], { icon: userIcon, interactive: false }).addTo(map);
      }

      // Red destination marker icon
      const destIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      destinationIconRef.current = destIcon;

      // Handle map click to set destination
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setSelection({ kind: 'point', source: 'map', lat, lon: lng });

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon: destIcon }).addTo(map);
        }
      });

      mapRef.current = map;

      // Trigger resize in case modal animates in
      setTimeout(() => map.invalidateSize(), 150);
    });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Destroy map when modal closes so it re-initialises fresh next open
  useEffect(() => {
    if (!isOpen && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
      destinationIconRef.current = null;
      setSelection(null);
    }
  }, [isOpen]);

  // Keep Leaflet CSS loaded
  useEffect(() => {
    const id = 'leaflet-css';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Select destination"
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
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Select Destination
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--card-border)] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <DestinationSearch
          onSelectStop={(stop: Stop) => placeSelection({ kind: 'stop', stop })}
          onSelectAddress={(address: AddressSearchResult) => placeSelection({
            kind: 'point',
            source: 'address',
            lat: address.lat,
            lon: address.lon,
            label: address.labelEn,
          })}
        />

        {/* Radius selector */}
        {selection?.kind !== 'stop' ? <div className="flex items-center gap-3 border-b border-[var(--divider)] px-4 py-2.5 bg-[var(--background)]">
          <span className="text-xs text-[var(--muted)]">Destination zone:</span>
          <div className="flex gap-1.5">
            {RADIUS_PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => onChangeRadius(preset)}
                className={clsx(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                  preset === destinationRadius
                    ? 'border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-400'
                    : 'border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--muted)] hover:border-blue-500/50',
                )}
              >
                {preset >= 1000 ? `${preset / 1000}km` : `${preset}m`}
              </button>
            ))}
          </div>
        </div> : (
          <div className="border-b border-[var(--divider)] bg-[var(--background)] px-4 py-2.5 text-xs font-medium text-blue-600 dark:text-blue-400">
            Exact stop
          </div>
        )}

        {/* Map */}
        <div className="relative">
          <div ref={mapContainerRef} className="h-72 sm:h-96 w-full" />
          {!selection && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white/90">
              Tap map to set destination
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--divider)] px-4 py-3">
          <p className="text-xs text-[var(--muted)]">
            {selection
              ? selection.kind === 'stop'
                ? selection.stop.name_en
                : `${selection.lat.toFixed(5)}, ${selection.lon.toFixed(5)}`
              : 'No point selected'}
          </p>
          <button
            disabled={!selection}
            onClick={() => {
              if (selection) onConfirm(selection);
            }}
            className={clsx(
              'rounded-xl px-4 py-2 text-sm font-semibold transition',
              selection
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'cursor-not-allowed bg-[var(--card-border)] text-[var(--muted)]',
            )}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
