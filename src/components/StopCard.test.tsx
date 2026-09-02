import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookmarkProvider } from '@/contexts/BookmarkContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { StopCard } from './StopCard';
import type { DirectRouteMatch, ETAEntry, NearbyStop, Stop } from '@/lib/types';

vi.mock('./StopLocationModal', () => ({
  StopLocationModal: ({ isOpen, stop }: { isOpen: boolean; stop: Stop }) => isOpen ? (
    <div role="dialog">{stop.name_tc}</div>
  ) : null,
}));

const stop: NearbyStop = {
  stop: 'ORIGIN01', name_en: 'Origin', name_tc: '起點', name_sc: '起点',
  lat: 22.3, long: 114.2, data_timestamp: '', distanceM: 20,
};

function eta(overrides: Partial<ETAEntry> = {}): ETAEntry {
  return {
    co: 'KMB', route: '88X', dir: 'O', service_type: '1', seq: 5, stop: 'ORIGIN01',
    dest_en: 'Destination', dest_tc: '目的地', dest_sc: '目的地', eta_seq: 1,
    eta: '2099-01-01T00:00:00+08:00', rmk_en: '', rmk_tc: '', rmk_sc: '',
    data_timestamp: '', ...overrides,
  };
}

const match: DirectRouteMatch = {
  route: '88X', bound: 'O', serviceType: '1', boardingSeq: 5,
  alightingStop: 'DEST0001', alightingSeq: 18,
};

afterEach(cleanup);

function renderCard(
  etas: ETAEntry[],
  matches: DirectRouteMatch[] | undefined,
  destinationStopNames = {},
  props: Partial<React.ComponentProps<typeof StopCard>> = {},
) {
  return render(
    <BookmarkProvider>
      <LanguageProvider>
        <StopCard
          stop={stop}
          etas={etas}
          routeFilters={[]}
          etasLoading={false}
          destinationMatches={matches}
          destinationStopNames={destinationStopNames}
          {...props}
        />
      </LanguageProvider>
    </BookmarkProvider>,
  );
}

describe('StopCard destination eligibility', () => {
  it('shows only ETA entries belonging to an exact eligible variant', () => {
    renderCard([
      eta({ route: 'WRONG' }),
      eta({ dir: 'I' }),
      eta({ service_type: '2' }),
      eta(),
    ], [match]);
    expect(screen.getByText('88X')).toBeDefined();
    expect(screen.queryByText('WRONG')).toBeNull();
  });

  it('keeps a topologically valid stop visible when no live ETA exists', () => {
    renderCard([], [match], { DEST0001: { en: 'Destination Stop', tc: '目的地站' } });
    expect(screen.getByText('暫無班次資料')).toBeDefined();
    expect(screen.getByText('ORIGIN01')).toBeDefined();
    expect(screen.getByText('落車站：')).toBeDefined();
    expect(screen.getByText('目的地站')).toBeDefined();
    expect(screen.getByText('88X')).toBeDefined();
  });

  it('lists distinct alighting stops across merged service types', () => {
    renderCard([], [
      match,
      { ...match, serviceType: '2', alightingStop: 'DEST0002', alightingSeq: 19 },
      { ...match, serviceType: '3' },
    ], {
      DEST0001: { en: 'First Stop', tc: '第一站' },
      DEST0002: { en: 'Second Stop', tc: '第二站' },
    });
    expect(screen.getByText('落車站：')).toBeDefined();
    expect(screen.getByText('第一站')).toBeDefined();
    expect(screen.getByText('第二站')).toBeDefined();
  });

  it('opens the selected alighting stop on the map', () => {
    const alightingStop: Stop = {
      stop: 'DEST0001', name_en: 'Destination Stop', name_tc: '目的地站', name_sc: '目的地站',
      lat: 22.31, long: 114.21, data_timestamp: '',
    };
    renderCard([], [match], { DEST0001: { en: 'Destination Stop', tc: '目的地站' } }, {
      destinationStops: { DEST0001: alightingStop },
    });

    fireEvent.click(screen.getByRole('button', { name: '在地圖上查看目的地站' }));
    expect(screen.getByRole('dialog').textContent).toBe('目的地站');
  });
});

describe('StopCard favourite route filtering', () => {
  it('leaves normal routes visible when disabled', () => {
    renderCard([eta(), eta({ route: '74B' })], undefined, {}, { favouritesOnly: false });
    expect(screen.getByText('88X')).toBeDefined();
    expect(screen.getByText('74B')).toBeDefined();
  });

  it('keeps only favourite routes in a mixed stop', () => {
    renderCard([eta(), eta({ route: '74B' })], undefined, {}, {
      favouritesOnly: true,
      favouriteRoutes: new Set(['74B']),
    });
    expect(screen.getByText('74B')).toBeDefined();
    expect(screen.queryByText('88X')).toBeNull();
    expect(screen.getByText('ORIGIN01')).toBeDefined();
  });

  it('hides a stop with no favourite routes', () => {
    renderCard([eta()], undefined, {}, {
      favouritesOnly: true,
      favouriteRoutes: new Set(['74B']),
    });
    expect(screen.queryByText('ORIGIN01')).toBeNull();
  });

  it('combines favourite and route-number filters with AND', () => {
    renderCard([eta(), eta({ route: '74B' })], undefined, {}, {
      routeFilters: ['74'],
      favouritesOnly: true,
      favouriteRoutes: new Set(['88X']),
    });
    expect(screen.queryByText('ORIGIN01')).toBeNull();
  });

  it('filters destination-valid routes, including routes without live ETA', () => {
    renderCard([], [match, { ...match, route: '74B' }], {}, {
      favouritesOnly: true,
      favouriteRoutes: new Set(['88X']),
    });
    expect(screen.getByText('88X')).toBeDefined();
    expect(screen.queryByText('74B')).toBeNull();
  });
});
