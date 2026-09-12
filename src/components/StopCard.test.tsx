import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  route: '88X', bound: 'O', serviceType: '1', boardingStop: 'ORIGIN01', boardingSeq: 5,
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
    </LanguageProvider>,
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

  it('keeps special service variants separate and gives each exact variant a Route Detail link', () => {
    renderCard([], [
      match,
      { ...match, serviceType: '2', alightingStop: 'DEST0002', alightingSeq: 19 },
      { ...match, serviceType: '3' },
    ], {
      DEST0001: { en: 'First Stop', tc: '第一站' },
      DEST0002: { en: 'Second Stop', tc: '第二站' },
    });
    expect(screen.getAllByText('落車站：')).toHaveLength(3);
    expect(screen.getAllByText('第一站')).toHaveLength(2);
    expect(screen.getByText('第二站')).toBeDefined();
    expect(screen.getAllByText('特別班')).toHaveLength(2);
    expect(screen.getByRole('link', { name: '查看88X路線詳情' }).getAttribute('href'))
      .toBe('/routes/88X?bound=O&serviceType=1&stop=ORIGIN01');
    expect(screen.getAllByRole('link', { name: '查看88X特別班路線詳情' }).map((link) => link.getAttribute('href')))
      .toEqual([
        '/routes/88X?bound=O&serviceType=2&stop=ORIGIN01',
        '/routes/88X?bound=O&serviceType=3&stop=ORIGIN01',
      ]);
  });

  it('keeps colocated stop IDs separate in Route Detail links', () => {
    renderCard([
      eta({ stop: 'ORIGIN01', service_type: '1' }),
      eta({ stop: 'ORIGIN02', service_type: '1', eta_seq: 2 }),
    ], undefined);
    const links = screen.getAllByRole('link', { name: '查看88X路線詳情' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/routes/88X?bound=O&serviceType=1&stop=ORIGIN01',
      '/routes/88X?bound=O&serviceType=1&stop=ORIGIN02',
    ]);
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

describe('StopCard ETA freshness', () => {
  it('labels stale predictions and removes their confident live colour', () => {
    const lastSuccessfulAt = new Date(Date.now() - 130_000);
    const upcoming = eta({ eta: new Date(Date.now() + 120_000).toISOString() });
    renderCard([upcoming], undefined, {}, {
      etaStates: {
        ORIGIN01: {
          data: [upcoming],
          lastSuccessfulAt,
          lastAttemptAt: lastSuccessfulAt,
          attemptStatus: 'error',
          error: 'Temporary API error',
          freshness: 'stale',
        },
      },
    });

    expect(screen.getByText('到站時間可能已過時', { exact: false })).toBeDefined();
    expect(screen.getByText('1 分').className).toContain('text-[var(--muted)]');
  });

  it('does not present five-minute-old predictions as live ETA', () => {
    const lastSuccessfulAt = new Date(Date.now() - 301_000);
    const upcoming = eta({ eta: new Date(Date.now() + 120_000).toISOString() });
    renderCard([upcoming], undefined, {}, {
      etaStates: {
        ORIGIN01: {
          data: [upcoming],
          lastSuccessfulAt,
          lastAttemptAt: lastSuccessfulAt,
          attemptStatus: 'error',
          error: 'Temporary API error',
          freshness: 'very-stale',
        },
      },
    });

    expect(screen.getByText('暫未能提供到站時間', { exact: false })).toBeDefined();
    expect(screen.queryByText('1 分')).toBeNull();
  });
});
