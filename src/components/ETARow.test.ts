import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMinutesUntil } from './ETARow';

describe('getMinutesUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rounds remaining time down to whole minutes', () => {
    expect(getMinutesUntil('2026-09-02T12:02:59.000Z')).toBe(2);
    expect(getMinutesUntil('2026-09-02T12:02:01.000Z')).toBe(2);
    expect(getMinutesUntil('2026-09-02T12:00:59.000Z')).toBe(0);
  });
});
