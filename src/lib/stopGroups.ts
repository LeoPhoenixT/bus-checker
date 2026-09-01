import type { Stop } from './types';

export function getStopIds(stop: Stop): string[] {
  return [stop.stop];
}
