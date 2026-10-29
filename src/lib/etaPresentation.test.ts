import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatETAMinutes, getETAPredictions, getNullETAMessage } from './etaPresentation';
import type { ETAEntry } from './types';

const row: ETAEntry = {
  co: 'KMB', route: '87D', dir: 'O', service_type: '1', seq: 1, stop: 'STOP1',
  dest_en: 'Destination', dest_tc: '目的地', dest_sc: '', eta_seq: 1,
  eta: null, rmk_en: '', rmk_tc: '', rmk_sc: '', data_timestamp: '',
};

describe('getNullETAMessage', () => {
  it('prefers the first nonempty remark in the selected language', () => {
    const rows = [row, { ...row, eta_seq: 2, rmk_en: 'Service suspended', rmk_tc: '班次暫停' }];
    expect(getNullETAMessage(rows, 'en')).toBe('Service suspended');
    expect(getNullETAMessage(rows, 'tc')).toBe('班次暫停');
  });

  it('distinguishes null predictions from an empty response', () => {
    expect(getNullETAMessage([row], 'tc')).toBe('暫無即時預報');
    expect(getNullETAMessage([], 'tc')).toBeNull();
  });
});

afterEach(() => vi.restoreAllMocks());

describe('getETAPredictions', () => {
  it('retains separate same-minute services, their order and remarks, and recent departures', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-11T12:00:00Z'));
    const rows = [
      { ...row, eta_seq: 3, eta: '2026-09-11T12:02:50Z', rmk_tc: '特別班' },
      { ...row, eta_seq: 1, eta: '2026-09-11T11:59:40Z' },
      { ...row, eta_seq: 2, eta: '2026-09-11T12:02:30Z', rmk_tc: '原定班次' },
      { ...row, eta_seq: 4, eta: '2026-09-11T11:58:00Z' },
      { ...row, eta_seq: 5, eta: 'invalid' },
      row,
    ];
    const predictions = getETAPredictions(rows);
    expect(predictions.map(({ minutes }) => minutes)).toEqual([-1, 2, 2]);
    expect(predictions.map(({ eta }) => eta.rmk_tc)).toEqual(['', '原定班次', '特別班']);
    expect(rows[0].eta_seq).toBe(3);
  });

  it('distinguishes departed, arriving and future predictions in both languages', () => {
    expect([-1, 0, 2].map((minutes) => formatETAMinutes(minutes, 'tc'))).toEqual(['已離站', '即將到達', '2 分']);
    expect([-1, 0, 2].map((minutes) => formatETAMinutes(minutes, 'en'))).toEqual(['Departed', 'Arriving', '2 min']);
  });
});
