import { describe, expect, it } from 'vitest';
import { getNullETAMessage } from './etaPresentation';
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
