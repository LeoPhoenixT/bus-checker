import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteDetailStop } from '@/lib/types';
import { RouteMap } from './RouteMap';

const leafletMocks = vi.hoisted(() => ({
  loadLeaflet: vi.fn(),
  addOpenStreetMapTiles: vi.fn(),
}));

vi.mock('@/lib/leaflet', () => leafletMocks);

const stops: RouteDetailStop[] = [
  { stopId: 'A', seq: 1, nameEn: 'Platform A', nameTc: '月台 A', lat: 22.3, long: 114.1 },
  { stopId: 'B', seq: 2, nameEn: 'Platform B', nameTc: '月台 B', lat: 22.3, long: 114.1 },
  { stopId: 'C', seq: 3, nameEn: 'Next Stop', nameTc: '下一站', lat: 22.31, long: 114.11 },
];

interface MarkerStub {
  bindTooltip: ReturnType<typeof vi.fn>;
  bindPopup: ReturnType<typeof vi.fn>;
  closePopup: ReturnType<typeof vi.fn>;
  click: () => void;
}

let markers: MarkerStub[];
let mapMock: {
  fitBounds: ReturnType<typeof vi.fn>;
  panTo: ReturnType<typeof vi.fn>;
  invalidateSize: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  closePopup: ReturnType<typeof vi.fn>;
  latLngToContainerPoint: ReturnType<typeof vi.fn>;
};
let popupMock: {
  setLatLng: ReturnType<typeof vi.fn>;
  setContent: ReturnType<typeof vi.fn>;
  openOn: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  markers = [];
  mapMock = {
    fitBounds: vi.fn(), panTo: vi.fn(), invalidateSize: vi.fn(), remove: vi.fn(), closePopup: vi.fn(),
    latLngToContainerPoint: vi.fn(([lat, long]: [number, number]) => ({ x: (long - 114) * 10_000, y: (lat - 22) * 10_000 })),
  };
  popupMock = { setLatLng: vi.fn(), setContent: vi.fn(), openOn: vi.fn() };
  popupMock.setLatLng.mockReturnValue(popupMock);
  popupMock.setContent.mockReturnValue(popupMock);
  popupMock.openOn.mockReturnValue(popupMock);
  leafletMocks.loadLeaflet.mockResolvedValue({
    map: vi.fn(() => mapMock),
    popup: vi.fn(() => popupMock),
    latLngBounds: vi.fn((coordinates) => coordinates),
    polyline: vi.fn(() => ({ addTo: vi.fn() })),
    circleMarker: vi.fn((coordinates: [number, number]) => {
      const marker = {
        addTo: vi.fn(),
        bindTooltip: vi.fn(),
        bindPopup: vi.fn(),
        closePopup: vi.fn(),
        on: vi.fn(),
        setStyle: vi.fn(),
        bringToFront: vi.fn(),
        getLatLng: vi.fn(() => coordinates),
        click: () => {},
      };
      marker.addTo.mockReturnValue(marker);
      marker.on.mockImplementation((_event: string, handler: () => void) => { marker.click = handler; return marker; });
      markers.push(marker);
      return marker;
    }),
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('RouteMap', () => {
  it('includes every nearby repeated group when their markers overlap on a phone', async () => {
    vi.stubGlobal('innerWidth', 390);
    const onSelectStop = vi.fn();
    const secondGroup = { ...stops[0], stopId: 'D', seq: 4, long: 114.1004, nameEn: 'Platform D' };
    const nearbySingle = { ...stops[2], lat: 22.3, long: 114.101 };
    render(<RouteMap stops={[stops[0], stops[1], secondGroup, { ...secondGroup, seq: 24 }, nearbySingle]} selectedStopKey={null} onSelectStop={onSelectStop} lang="en" />);

    await waitFor(() => expect(markers).toHaveLength(3));
    markers[2].click();
    const choices = popupMock.setContent.mock.calls[0][0] as HTMLElement;
    expect(choices.textContent).toContain('Choose a route stop (5)');
    expect(choices.textContent).toContain('Scroll for more stops');
    expect([...choices.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      '4. Platform D', '24. Platform D', '1. Platform A', '2. Platform B', '3. Next Stop',
    ]);
    fireEvent.click(choices.querySelectorAll('button')[3]);
    expect(onSelectStop).toHaveBeenCalledExactlyOnceWith({ stopId: 'B', seq: 2 });
  });

  it('offers a covered multi-occurrence stop when a nearby marker receives a phone tap', async () => {
    vi.stubGlobal('innerWidth', 390);
    const onSelectStop = vi.fn();
    const nearbySingle = { ...stops[2], lat: 22.3, long: 114.101 };
    render(<RouteMap stops={[stops[0], stops[1], nearbySingle]} selectedStopKey={null} onSelectStop={onSelectStop} lang="en" />);

    await waitFor(() => expect(markers).toHaveLength(2));
    markers[1].click();
    const choices = popupMock.setContent.mock.calls[0][0] as HTMLElement;
    expect(choices.getAttribute('aria-label')).toBe('Choose a nearby route stop');
    expect(choices.querySelectorAll('button')).toHaveLength(3);
    expect([...choices.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['1. Platform A', '2. Platform B', '3. Next Stop']);
    expect(popupMock.openOn).toHaveBeenCalledWith(mapMock);
    fireEvent.click(choices.querySelectorAll('button')[1]);
    expect(onSelectStop).toHaveBeenCalledExactlyOnceWith({ stopId: 'B', seq: 2 });
    expect(mapMock.closePopup).toHaveBeenCalledOnce();
  });

  it('keeps separate popup choices for repeated occurrences of the same stop ID', async () => {
    const onSelectStop = vi.fn();
    render(<RouteMap stops={[stops[0], { ...stops[0], seq: 23 }]} selectedStopKey={null} onSelectStop={onSelectStop} lang="en" />);
    await waitFor(() => expect(markers).toHaveLength(1));
    const choices = markers[0].bindPopup.mock.calls[0][0] as HTMLElement;
    expect(choices.querySelectorAll('button')).toHaveLength(2);
    fireEvent.click(choices.querySelectorAll('button')[1]);
    expect(onSelectStop).toHaveBeenCalledExactlyOnceWith({ stopId: 'A', seq: 23 });
  });
  it('keeps occurrences of one stop ID together even when another stop shares its coordinates', async () => {
    render(<RouteMap stops={[stops[0], stops[1], { ...stops[0], seq: 23 }]} selectedStopKey={null} onSelectStop={vi.fn()} lang="en" />);
    await waitFor(() => expect(markers).toHaveLength(1));
    const choices = markers[0].bindPopup.mock.calls[0][0] as HTMLElement;
    expect([...choices.querySelectorAll('button')].map((button) => button.textContent)).toEqual([
      '1. Platform A', '23. Platform A', '2. Platform B',
    ]);
  });
  it('passes upstream stop names to Leaflet as text rather than HTML', async () => {
    const unsafeName = '<img src=x onerror=alert(1)>';
    render(<RouteMap stops={[{ ...stops[2], nameEn: unsafeName }]} selectedStopKey={null} onSelectStop={vi.fn()} lang="en" />);

    await waitFor(() => expect(markers).toHaveLength(1));
    const tooltip = markers[0].bindTooltip.mock.calls[0][0] as HTMLElement;
    expect(tooltip).toBeInstanceOf(HTMLElement);
    expect(tooltip.textContent).toBe(`3. ${unsafeName}`);
    expect(tooltip.querySelector('img')).toBeNull();
  });

  it('selects a stop directly when its marker has one stop ID', async () => {
    const onSelectStop = vi.fn();
    render(<RouteMap stops={[stops[2]]} selectedStopKey={null} onSelectStop={onSelectStop} lang="en" />);

    await waitFor(() => expect(markers).toHaveLength(1));
    markers[0].click();
    expect(onSelectStop).toHaveBeenCalledExactlyOnceWith({ stopId: 'C', seq: 3 });
    expect(markers[0].bindPopup).not.toHaveBeenCalled();
  });

  it('lets a rider choose either stop ID at identical coordinates', async () => {
    const onSelectStop = vi.fn();
    const unsafeName = '<img src=x onerror=alert(1)>';
    render(<RouteMap stops={[stops[0], { ...stops[1], nameEn: unsafeName }, stops[2]]} selectedStopKey={null} onSelectStop={onSelectStop} lang="en" />);

    await waitFor(() => expect(markers).toHaveLength(2));
    const choices = markers[0].bindPopup.mock.calls[0][0] as HTMLElement;
    expect(choices.getAttribute('aria-label')).toBe('Choose a stop at this location');
    expect(choices.querySelectorAll('button')).toHaveLength(2);
    expect(choices.querySelectorAll('button')[1].textContent).toBe(`2. ${unsafeName}`);
    expect(choices.querySelector('img')).toBeNull();
    fireEvent.click(choices.querySelectorAll('button')[1]);
    expect(onSelectStop).toHaveBeenCalledExactlyOnceWith({ stopId: 'B', seq: 2 });
    expect(markers[0].closePopup).toHaveBeenCalledOnce();
  });
});
