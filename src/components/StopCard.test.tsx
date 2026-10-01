import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  it('shows separate boarding passes with links and alighting points for each sequence', () => {
    renderCard([eta({ seq: 5 }), eta({ seq: 23 })], [match, { ...match, boardingSeq: 23, alightingStop: 'DEST0002', alightingSeq: 30 }]);
    expect(screen.getByText('於第 5 站上車')).toBeDefined();
    expect(screen.getByText('於第 23 站上車')).toBeDefined();
    const links = screen.getAllByRole('link', { name: /查看88X路線詳情/ });
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/routes/88X?bound=O&serviceType=1&stop=ORIGIN01&seq=5', '/routes/88X?bound=O&serviceType=1&stop=ORIGIN01&seq=23']);
  });
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
      .toBe('/routes/88X?bound=O&serviceType=1&stop=ORIGIN01&seq=5');
    expect(screen.getAllByRole('link', { name: '查看88X特別班路線詳情' }).map((link) => link.getAttribute('href')))
      .toEqual([
        '/routes/88X?bound=O&serviceType=2&stop=ORIGIN01&seq=5',
        '/routes/88X?bound=O&serviceType=3&stop=ORIGIN01&seq=5',
      ]);
  });

  it('keeps colocated stop IDs separate in Route Detail links', () => {
    renderCard([
      eta({ stop: 'ORIGIN01', service_type: '1' }),
      eta({ stop: 'ORIGIN02', service_type: '1', eta_seq: 2 }),
    ], undefined);
    const links = screen.getAllByRole('link', { name: '查看88X路線詳情' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/routes/88X?bound=O&serviceType=1&stop=ORIGIN01&seq=5',
      '/routes/88X?bound=O&serviceType=1&stop=ORIGIN02&seq=5',
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

describe('StopCard route list', () => {
  const manyEtas = () => Array.from({ length: 7 }, (_, index) => eta({
    route: `R${index + 1}`,
    eta: index === 0 ? null : new Date(Date.now() + (index === 1 ? 20 : index) * 60_000).toISOString(),
  }));

  it('shows five routes with the earliest valid ETAs first and lets riders reveal the rest', () => {
    renderCard(manyEtas(), undefined);
    expect(screen.getAllByRole('link', { name: /查看R[0-9]路線詳情/ }).map((link) => link.textContent)).toEqual(['R3', 'R4', 'R5', 'R6', 'R7']);
    expect(screen.getByRole('button', { name: '顯示其餘 2 條路線' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '顯示其餘 2 條路線' }));
    expect(screen.getAllByRole('link', { name: /查看R[0-9]路線詳情/ })).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: '收起路線' }));
    expect(screen.getAllByRole('link', { name: /查看R[0-9]路線詳情/ })).toHaveLength(5);
  });

  it('keeps all matches visible when a route filter or destination is active', () => {
    const { unmount } = renderCard(manyEtas(), undefined, {}, { routeFilters: ['R'] });
    expect(screen.getAllByRole('link', { name: /查看R[0-9]路線詳情/ })).toHaveLength(7);
    expect(screen.queryByRole('button', { name: /顯示其餘/ })).toBeNull();
    unmount();

    const matches = Array.from({ length: 7 }, (_, index) => ({ ...match, route: `R${index + 1}` }));
    renderCard([], matches);
    expect(screen.getAllByRole('link', { name: /查看R[0-9]路線詳情/ })).toHaveLength(7);
    expect(screen.queryByRole('button', { name: /顯示其餘/ })).toBeNull();
  });

  it('does not discard a timed arrival after three null ETA rows', () => {
    renderCard([
      eta({ eta_seq: 1, eta: null, rmk_tc: '班次暫停' }),
      eta({ eta_seq: 2, eta: null, rmk_tc: '班次暫停' }),
      eta({ eta_seq: 3, eta: null, rmk_tc: '班次暫停' }),
      eta({ eta_seq: 4, eta: new Date(Date.now() + 600_000).toISOString() }),
    ], undefined);
    expect(screen.getByText(/^[0-9]+ 分$/)).toBeDefined();
    expect(screen.queryByText('班次暫停')).toBeNull();
  });
});

describe('StopCard service-type predictions', () => {
  const variants = () => [eta(), eta({ service_type: '3', seq: 17 }), eta({ service_type: '4', seq: 22 })];

  it('shows shared times once and exposes every exact service-type link', () => {
    renderCard(variants(), undefined);
    const group = screen.getByRole('group', { name: '88X 往 目的地路線版本' });
    expect(within(group).getAllByText(/^[0-9]+ 分$/)).toHaveLength(1);
    const badge = within(group).getByText('88X', { exact: true });
    const chooser = within(group).getByText('3 個路線版本 · 查看詳情');
    expect(badge.className).toContain('rounded-lg');
    expect(badge.compareDocumentPosition(chooser) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(group).getByText('類型 1、3、4 · 共用預報')).toBeDefined();
    fireEvent.click(within(group).getByText('3 個路線版本 · 查看詳情'));
    expect(within(group).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/routes/88X?bound=O&serviceType=1&stop=ORIGIN01&seq=5',
      '/routes/88X?bound=O&serviceType=3&stop=ORIGIN01&seq=17',
      '/routes/88X?bound=O&serviceType=4&stop=ORIGIN01&seq=22',
    ]);
  });

  it('preserves the open variant chooser when forecasts diverge or return to identical values', () => {
    const view = (etas: ETAEntry[]) => <LanguageProvider><StopCard stop={stop} etas={etas} routeFilters={[]} etasLoading={false} /></LanguageProvider>;
    const { rerender } = render(view(variants()));
    const chooser = screen.getByText('3 個路線版本 · 查看詳情').closest('details')!;
    fireEvent.click(screen.getByText('3 個路線版本 · 查看詳情'));
    expect(chooser.open).toBe(true);
    const changed = variants();
    changed[2].eta = '2099-01-01T00:10:00+08:00';
    rerender(view(changed));
    expect(screen.getByText('3 個路線版本 · 查看詳情').closest('details')).toBe(chooser);
    expect(chooser.open).toBe(true);
    expect(screen.getAllByText(/^[0-9]+ 分$/)).toHaveLength(2);
    expect(screen.getByText('類型 1、3 · 共用預報')).toBeDefined();
    rerender(view(variants()));
    expect(chooser.open).toBe(true);
    expect(screen.getAllByText(/^[0-9]+ 分$/)).toHaveLength(1);
  });

  it('retains separate empty predictions and remarks inside one stable route container', () => {
    renderCard([eta({ eta: null }), eta({ service_type: '3', seq: 17, eta: null, rmk_tc: '暫停服務' })], undefined);
    expect(screen.getByText('暫無即時預報')).toBeDefined();
    expect(screen.getByText('暫停服務')).toBeDefined();
    expect(screen.queryByText(/共用預報/)).toBeNull();
  });

  it('shows distinct primary prediction remarks instead of sharing their identical times', () => {
    renderCard([eta({ rmk_tc: '原定班次' }), eta({ service_type: '3', seq: 17, rmk_tc: '最後班次' })], undefined);
    expect(screen.getByText('原定班次')).toBeDefined();
    expect(screen.getByText('最後班次')).toBeDefined();
    expect(screen.getAllByText(/^[0-9]+ 分$/)).toHaveLength(2);
    expect(screen.queryByText(/共用預報/)).toBeNull();
  });

  it('counts route containers rather than variants for the five-route limit', () => {
    renderCard([
      ...variants().map((entry) => ({ ...entry, route: 'R1' })),
      ...Array.from({ length: 6 }, (_, index) => eta({ route: `R${index + 2}` })),
    ], undefined);
    expect(screen.getByText('R5')).toBeDefined();
    expect(screen.queryByText('R6')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '顯示其餘 2 條路線' }));
    expect(screen.getByText('R7')).toBeDefined();
  });

  it('keeps destination-eligible variants separate even when their forecasts match', () => {
    renderCard(variants(), [match, { ...match, serviceType: '3', boardingSeq: 17 }, { ...match, serviceType: '4', boardingSeq: 22 }]);
    expect(screen.queryByText(/路線版本/)).toBeNull();
    expect(screen.getAllByRole('link', { name: /查看88X/ })).toHaveLength(3);
    expect(screen.getAllByText(/^[0-9]+ 分$/)).toHaveLength(3);
  });

  it('keeps repeated boarding occurrences visible with their own exact links', () => {
    renderCard([eta(), eta({ seq: 23 }), eta({ service_type: '3', seq: 17 })], undefined);
    expect(screen.queryByText(/路線版本/)).toBeNull();
    expect(screen.getByText('於第 5 站上車')).toBeDefined();
    expect(screen.getByText('於第 23 站上車')).toBeDefined();
    expect(screen.getAllByRole('link', { name: /查看88X/ })).toHaveLength(3);
  });

  it.each(['very-stale', 'unavailable'] as const)('does not label unusable cached data as shared predictions: %s', (freshness) => {
    const future = new Date(Date.now() + 120_000).toISOString();
    const data = variants().map((entry) => ({ ...entry, eta: future }));
    const lastSuccessfulAt = freshness === 'unavailable' ? null : new Date(Date.now() - 301_000);
    renderCard(data, undefined, {}, { etaStates: { ORIGIN01: {
      data, lastSuccessfulAt, lastAttemptAt: new Date(), attemptStatus: 'error', error: 'Upstream failure', freshness,
    } } });
    expect(screen.queryByText(/共用預報/)).toBeNull();
    expect(screen.queryByText(/^[0-9]+ 分$/)).toBeNull();
    expect(screen.getAllByText('暫未能提供')).toHaveLength(3);
    expect(screen.queryByText('Upstream failure')).toBeNull();
  });

  it('keeps initial loading distinct from shared cached predictions', () => {
    renderCard(variants(), undefined, {}, { etaStates: { ORIGIN01: {
      data: [], lastSuccessfulAt: null, lastAttemptAt: new Date(), attemptStatus: 'loading', error: null, freshness: 'unavailable',
    } } });
    expect(screen.queryByText(/共用預報/)).toBeNull();
    expect(screen.queryByText(/^[0-9]+ 分$/)).toBeNull();
    expect(screen.getAllByText('正在載入到站時間…')).toHaveLength(3);
  });

  it('renders sparse optional destination and remark fields without throwing', () => {
    const data = variants();
    data.forEach((entry) => {
      const sparse = entry as Partial<ETAEntry>;
      delete sparse.dest_sc;
      delete sparse.rmk_en;
      delete sparse.rmk_tc;
      delete sparse.rmk_sc;
    });
    renderCard(data, undefined);
    expect(screen.getByText('類型 1、3、4 · 共用預報')).toBeDefined();
    expect(screen.getAllByText(/^[0-9]+ 分$/)).toHaveLength(1);
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
