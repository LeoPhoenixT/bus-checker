import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { getCachedStops } from '@/lib/clientStops';
import { DestinationModal } from './DestinationModal';
import type { DestinationSelection } from '@/lib/types';

const leafletMocks = vi.hoisted(() => {
  const marker = {
    addTo: vi.fn(),
    setLatLng: vi.fn(),
  };
  marker.addTo.mockReturnValue(marker);

  return {
    map: {
      on: vi.fn(),
      invalidateSize: vi.fn(),
      remove: vi.fn(),
      flyTo: vi.fn(),
    },
    marker,
    createMarker: vi.fn(() => marker),
    loadLeaflet: vi.fn(),
    addOpenStreetMapTiles: vi.fn(),
    createRedMarkerIcon: vi.fn(),
  };
});

vi.mock('@/lib/clientStops', () => ({ getCachedStops: vi.fn() }));
vi.mock('@/lib/leaflet', () => ({
  loadLeaflet: leafletMocks.loadLeaflet,
  addOpenStreetMapTiles: leafletMocks.addOpenStreetMapTiles,
  createRedMarkerIcon: leafletMocks.createRedMarkerIcon,
}));

const destination: DestinationSelection = {
  kind: 'stop',
  stop: {
    stop: 'CENTRAL1',
    name_en: 'Central Bus Terminus',
    name_tc: '中環巴士總站',
    name_sc: '中环巴士总站',
    lat: 22.28,
    long: 114.16,
    data_timestamp: '',
  },
};

function modal(
  isOpen: boolean,
  onConfirm = vi.fn(),
  currentDestination: DestinationSelection = destination,
) {
  return (
    <LanguageProvider>
      <DestinationModal
        isOpen={isOpen}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        currentDestination={currentDestination}
        userLat={22.3}
        userLon={114.17}
        destinationRadius={500}
        onChangeRadius={vi.fn()}
      />
    </LanguageProvider>
  );
}

beforeEach(() => {
  vi.mocked(getCachedStops).mockResolvedValue([]);
  leafletMocks.loadLeaflet.mockResolvedValue({
    map: vi.fn(() => leafletMocks.map),
    marker: leafletMocks.createMarker,
    divIcon: vi.fn(() => ({})),
  });
  leafletMocks.createRedMarkerIcon.mockReturnValue({});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DestinationModal', () => {
  it('restores the confirmed destination when reopened', async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(modal(true, onConfirm));

    await waitFor(() => expect(leafletMocks.createMarker).toHaveBeenCalledWith(
      [22.28, 114.16],
      expect.anything(),
    ));
    expect(screen.getByDisplayValue('中環巴士總站')).toBeDefined();
    expect(screen.getByText('中環巴士總站')).toBeDefined();
    expect(screen.getByRole('button', { name: '確認' }).hasAttribute('disabled')).toBe(false);

    rerender(modal(false, onConfirm));
    rerender(modal(true, onConfirm));

    await waitFor(() => expect(screen.getByDisplayValue('中環巴士總站')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    expect(onConfirm).toHaveBeenCalledWith(destination);
  });

  it('does not put a map pin into the destination search field', async () => {
    const mapDestination: DestinationSelection = {
      kind: 'point',
      source: 'map',
      lat: 22.28,
      lon: 114.16,
    };
    render(modal(true, vi.fn(), mapDestination));

    await waitFor(() => expect(leafletMocks.createMarker).toHaveBeenCalledWith(
      [22.28, 114.16],
      expect.anything(),
    ));
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('22.28000, 114.16000')).toBeDefined();
  });
});
