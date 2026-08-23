const LEAFLET_ASSET_BASE = 'https://unpkg.com/leaflet@1.9.4/dist';
const RED_MARKER_BASE = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img';

let leafletPromise: Promise<typeof import('leaflet')> | null = null;

function ensureLeafletStyles(): void {
  const id = 'leaflet-css';
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `${LEAFLET_ASSET_BASE}/leaflet.css`;
  document.head.appendChild(link);
}

export function loadLeaflet(): Promise<typeof import('leaflet')> {
  ensureLeafletStyles();
  leafletPromise ??= import('leaflet').then((leaflet) => {
    delete (leaflet.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    leaflet.Icon.Default.mergeOptions({
      iconUrl: `${LEAFLET_ASSET_BASE}/images/marker-icon.png`,
      iconRetinaUrl: `${LEAFLET_ASSET_BASE}/images/marker-icon-2x.png`,
      shadowUrl: `${LEAFLET_ASSET_BASE}/images/marker-shadow.png`,
    });
    return leaflet;
  });
  return leafletPromise;
}

export function addOpenStreetMapTiles(
  leaflet: typeof import('leaflet'),
  map: import('leaflet').Map,
): void {
  leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);
}

export function createRedMarkerIcon(leaflet: typeof import('leaflet')): import('leaflet').Icon {
  return leaflet.icon({
    iconUrl: `${RED_MARKER_BASE}/marker-icon-red.png`,
    iconRetinaUrl: `${RED_MARKER_BASE}/marker-icon-2x-red.png`,
    shadowUrl: `${LEAFLET_ASSET_BASE}/images/marker-shadow.png`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
}
