import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { getCachedStops } from '@/lib/clientStops';
import { DestinationModal } from './DestinationModal';
import { StopLocationModal } from './StopLocationModal';
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

const destination = {
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
} satisfies DestinationSelection;

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
      />
    </LanguageProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
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
    expect(onConfirm).toHaveBeenCalledWith(destination, 500);
    expect(screen.queryByRole('button', { name: '500m' })).toBeNull();
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

  it('scopes destination and radius changes to a single opening and confirms both together', async () => {
    const confirmed: DestinationSelection = { kind: 'point', source: 'map', lat: 22.28, lon: 114.16 };
    const onConfirm = vi.fn();
    function Picker() {
      const [open, setOpen] = useState(false);
      return <LanguageProvider>
        <button type="button" onClick={() => setOpen(true)}>Open destination</button>
        <DestinationModal isOpen={open} onClose={() => setOpen(false)} onConfirm={onConfirm}
          currentDestination={confirmed} userLat={null} userLon={null} destinationRadius={500} />
      </LanguageProvider>;
    }

    render(<Picker />);
    const opener = screen.getByRole('button', { name: 'Open destination' });
    function openPicker() {
      opener.focus();
      fireEvent.click(opener);
      expect(document.activeElement).toBe(screen.getByRole('combobox'));
      expect(screen.getByRole('button', { name: '500m', pressed: true })).toBeDefined();
      expect(screen.getByText('22.28000, 114.16000')).toBeDefined();
    }

    openPicker();
    await waitFor(() => expect(leafletMocks.map.on).toHaveBeenCalledWith('click', expect.any(Function)));
    const [, clickMap] = leafletMocks.map.on.mock.lastCall!;
    act(() => clickMap({ latlng: { lat: 22.3, lng: 114.2 } }));
    expect(screen.getByText('22.30000, 114.20000')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '1km' }));
    expect(screen.getByRole('button', { name: '1km', pressed: true })).toBeDefined();
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: '關閉' });
    const confirm = within(dialog).getByRole('button', { name: '確認' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(document.activeElement).toBe(opener);
    expect(onConfirm).not.toHaveBeenCalled();

    openPicker();
    fireEvent.click(screen.getByRole('button', { name: '2km' }));
    fireEvent.click(screen.getByRole('button', { name: '關閉' }));
    expect(document.activeElement).toBe(opener);

    openPicker();
    fireEvent.click(screen.getByRole('button', { name: '100m' }));
    const overlay = screen.getByRole('dialog').previousElementSibling!;
    fireEvent.click(overlay);
    expect(document.activeElement).toBe(opener);

    openPicker();
    fireEvent.click(screen.getByRole('button', { name: '200m' }));
    fireEvent.click(screen.getByRole('button', { name: '確認' }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(confirmed, 200);
  });
});

it('focuses the stop-location close button, wraps focus and restores the opener on Escape', () => {
  function Preview() {
    const [open, setOpen] = useState(false);
    return <LanguageProvider>
      <button type="button" onClick={() => setOpen(true)}>Open stop</button>
      <StopLocationModal isOpen={open} onClose={() => setOpen(false)} stop={destination.stop} />
    </LanguageProvider>;
  }

  render(<Preview />);
  const opener = screen.getByRole('button', { name: 'Open stop' });
  opener.focus();
  fireEvent.click(opener);
  const close = screen.getByRole('button', { name: '關閉' });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: 'Tab' });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(close, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(opener);
});
