'use client';

import { useEffect, useRef, useState } from 'react';
import { X, MapPin } from 'lucide-react';
import clsx from 'clsx';
import { RADIUS_PRESETS } from '@/config';
import { useLang } from '@/contexts/LanguageContext';
import { addOpenStreetMapTiles, createRedMarkerIcon, loadLeaflet } from '@/lib/leaflet';
import { DestinationSearch } from './DestinationSearch';
import { MapDialog } from './MapDialog';
import type { AddressSearchResult, DestinationSelection, Stop } from '@/lib/types';

interface DestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selection: DestinationSelection, radius: number) => void;
  currentDestination: DestinationSelection | null;
  userLat: number | null;
  userLon: number | null;
  destinationRadius: number;
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

export function DestinationModal({ isOpen, ...props }: DestinationModalProps) {
  return isOpen ? <DestinationPicker {...props} /> : null;
}

function DestinationPicker({
  onClose,
  onConfirm,
  currentDestination,
  userLat,
  userLon,
  destinationRadius,
}: Omit<DestinationModalProps, 'isOpen'>) {
  const { lang } = useLang();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const addMarkerRef = useRef<((coordinates: [number, number]) => LeafletMarker) | null>(null);
  const latestSelection = useRef(currentDestination);
  const [selection, setSelection] = useState(currentDestination);
  const [draftRadius, setDraftRadius] = useState(destinationRadius);

  const placeSelection = (nextSelection: DestinationSelection) => {
    latestSelection.current = nextSelection;
    setSelection(nextSelection);
    const coordinates = getSelectionCoordinates(nextSelection);
    mapRef.current?.flyTo(coordinates, 17);
    if (markerRef.current) {
      markerRef.current.setLatLng(coordinates);
    } else if (addMarkerRef.current) {
      markerRef.current = addMarkerRef.current(coordinates);
    }
  };

  // Initialise Leaflet map (client-side only — Leaflet requires window)
  useEffect(() => {
    let cancelled = false;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;

    loadLeaflet().then((L) => {
      if (cancelled || !mapContainerRef.current) return;

      const selectedPoint = latestSelection.current && getSelectionCoordinates(latestSelection.current);
      const centerLat = selectedPoint?.[0] ?? userLat ?? 22.3193;
      const centerLon = selectedPoint?.[1] ?? userLon ?? 114.1694;

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
      const destIcon: LeafletIcon = createRedMarkerIcon(L);
      const addMarker = (coordinates: [number, number]) => L.marker(coordinates, { icon: destIcon }).addTo(map);
      addMarkerRef.current = addMarker;

      if (selectedPoint) {
        markerRef.current = addMarker(selectedPoint);
      }

      // Handle map click to set destination
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const nextSelection = { kind: 'point', source: 'map', lat, lon: lng } as const;
        latestSelection.current = nextSelection;
        setSelection(nextSelection);

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = addMarker([lat, lng]);
        }
      });

      mapRef.current = map;

      // Trigger resize in case modal animates in
      resizeTimer = setTimeout(() => map.invalidateSize(), 150);
    });

    return () => {
      cancelled = true;
      clearTimeout(resizeTimer);
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      addMarkerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MapDialog label={lang === 'en' ? 'Select destination' : '選擇目的地'} onClose={onClose}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--divider)] px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            {lang === 'en' ? 'Select Destination' : '選擇目的地'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={lang === 'en' ? 'Close' : '關閉'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--card-border)] focus-visible:ring-2 focus-visible:ring-blue-500"
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
      {selection?.kind !== 'stop' ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--divider)] px-4 py-2.5 bg-[var(--background)]">
        <span className="text-xs text-[var(--muted)]">{lang === 'en' ? 'Destination zone:' : '目的地範圍：'}</span>
        <div className="flex flex-wrap gap-1.5">
          {RADIUS_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={preset === draftRadius}
              onClick={() => setDraftRadius(preset)}
              className={clsx(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium transition',
                preset === draftRadius
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
          type="button"
          disabled={!selection}
          onClick={() => {
            if (selection) onConfirm(selection, draftRadius);
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
    </MapDialog>
  );
}
