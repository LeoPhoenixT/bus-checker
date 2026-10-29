import { expect, it, vi } from 'vitest';
import { createServiceDayCache } from './serviceDayCache';

it('does not let a superseded failure poison the current day or clear its pending refresh', async () => {
  let rejectOld!: (cause: Error) => void;
  let resolveNew!: (value: string) => void;
  const load = vi.fn<() => Promise<string>>()
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectOld = reject; }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveNew = resolve; }));
  const onFailure = vi.fn();
  const cache = createServiceDayCache({ load, toError: (cause) => cause as Error, onFailure });
  const old = cache.get(new Date('2026-08-04T21:09:00Z'));
  const failed = expect(old).rejects.toThrow('Previous day failed');
  const current = cache.get(new Date('2026-08-04T21:10:00Z'));
  rejectOld(new Error('Previous day failed'));
  await failed;
  expect(cache.get(new Date('2026-08-04T21:10:10Z'))).toBe(current);
  resolveNew('current');
  await expect(current).resolves.toBe('current');
  await expect(cache.get(new Date('2026-08-04T21:11:00Z'))).resolves.toBe('current');
  expect(load).toHaveBeenCalledTimes(2);
  expect(onFailure).not.toHaveBeenCalled();
});
