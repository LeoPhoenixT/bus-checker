import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BookmarkProvider } from '@/contexts/BookmarkContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { StopCard } from './StopCard';
import type { DirectRouteMatch, ETAEntry, NearbyStop } from '@/lib/types';

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
  matches: DirectRouteMatch[],
  destinationStopNames = {},
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
    expect(screen.getByText('落車站：目的地站')).toBeDefined();
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
    expect(screen.getByText('落車站：第一站 / 第二站')).toBeDefined();
  });
});
