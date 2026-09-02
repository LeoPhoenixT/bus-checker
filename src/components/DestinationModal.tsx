'use client';

import { useEffect, useRef, useState } from 'react';
import { X, MapPin } from 'lucide-react';
import clsx from 'clsx';
import { RADIUS_PRESETS } from '@/config';
import { useLang } from '@/contexts/LanguageContext';
import { addOpenStreetMapTiles, createRedMarkerIcon, loadLeaflet } from '@/lib/leaflet';
import { DestinationSearch } from './DestinationSearch';
import type { AddressSearchResult, DestinationSelection, Stop } from '@/lib/types';

interface DestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selection: DestinationSelection) => void;
  currentDestination: DestinationSelection | null;
  userLat: number | null;
  userLon: number | null;
  destinationRadius: number;
  onChangeRadius: (r: number) => void;
}

// Leaflet types (loaded dynamically, not at module level)
type LeafletMap = import('leaflet').Map;
type LeafletMarker = import('leaflet').Marker;
type LeafletIcon = import('leaflet').Icon;

function getSelectionCoordinates(selection: DestinationSelection): [number, number] {
  return selection.kind === 'stop'
    ? [Number(selection.stop.lat), Number(selection.stop.long)]
    : [selection.lat, selection.lon];
}

function getSelectionLabel(selection: DestinationSelection, lang: 'en' | 'tc'): string {
  if (selection.kind === 'stop') return lang === 'en' ? selection.stop.name_en : selection.stop.name_tc;
  return selection.label ?? `${selection.lat.toFixed(5)}, ${selection.lon.toFixed(5)}`;
}

function getSearchQuery(selection: DestinationSelection, lang: 'en' | 'tc'): string {
  if (selection.kind === 'stop') return lang === 'en' ? selection.stop.name_en : selection.stop.name_tc;
  return selection.source === 'address' ? selection.label ?? '' : '';
}

export function DestinationModal({
  isOpen,
  onClose,
  onConfirm,
  currentDestination,
  userLat,
  userLon,
  destinationRadius,
  onChangeRadius,
}: DestinationModalProps) {
  const { lang } = useLang();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const destinationIconRef = useRef<LeafletIcon | null>(null);
  const [selection, setSelection] = useState<DestinationSelection | null>(null);

  const placeSelection = (nextSelection: DestinationSelection) => {
    setSelection(nextSelection);
    const [lat, lon] = getSelectionCoordinates(nextSelection);
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([lat, lon], 17);
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else if (destinationIconRef.current) {
      void loadLeaflet().then((L) => {
        if (mapRef.current && destinationIconRef.current) {
          markerRef.current = L.marker([lat, lon], { icon: destinationIconRef.current }).addTo(mapRef.current);
        }
      });
    }
  };

  useEffect(() => {
    if (isOpen) setSelection(currentDestination);
  }, [currentDestination, isOpen]);

  // Initialise Leaflet map (client-side only — Leaflet requires window)
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;
    if (mapRef.current) return; // already initialised

    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      // Prefer the confirmed destination so reopening the picker shows its current selection.
      const savedDestination = currentDestination && getSelectionCoordinates(currentDestination);
      const centerLat = savedDestination?.[0] ?? userLat ?? 22.3193;
      const centerLon = savedDestination?.[1] ?? userLon ?? 114.1694;

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLon],
        zoom: 16,
        zoomControl: true,
      });

      addOpenStreetMapTiles(L, map);

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
      const destIcon = createRedMarkerIcon(L);
      destinationIconRef.current = destIcon;

      if (savedDestination) {
        markerRef.current = L.marker(savedDestination, { icon: destIcon }).addTo(map);
      }

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

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'en' ? 'Select destination' : '選擇目的地'}
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
              {lang === 'en' ? 'Select Destination' : '選擇目的地'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close' : '關閉'}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--card-border)] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <DestinationSearch
          initialQuery={currentDestination ? getSearchQuery(currentDestination, lang) : ''}
          onSelectStop={(stop: Stop) => placeSelection({ kind: 'stop', stop })}
          onSelectAddress={(address: AddressSearchResult) => placeSelection({
            kind: 'point',
            source: 'address',
            lat: address.lat,
            lon: address.lon,
            label: lang === 'en' ? address.labelEn : address.labelTc,
          })}
        />

        {/* Radius selector */}
        {selection?.kind !== 'stop' ? <div className="flex items-center gap-3 border-b border-[var(--divider)] px-4 py-2.5 bg-[var(--background)]">
          <span className="text-xs text-[var(--muted)]">{lang === 'en' ? 'Destination zone:' : '目的地範圍：'}</span>
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
            {lang === 'en' ? 'Exact stop' : '指定巴士站'}
          </div>
        )}

        {/* Map */}
        <div className="relative">
          <div ref={mapContainerRef} className="h-72 sm:h-96 w-full" />
          {!selection && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white/90">
              {lang === 'en' ? 'Tap map to set destination' : '點按地圖設定目的地'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--divider)] px-4 py-3">
          <p className="text-xs text-[var(--muted)]">
            {selection
              ? getSelectionLabel(selection, lang)
              : lang === 'en' ? 'No point selected' : '尚未選擇位置'}
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
            {lang === 'en' ? 'Confirm' : '確認'}
          </button>
        </div>
      </div>
    </div>
  );
}
