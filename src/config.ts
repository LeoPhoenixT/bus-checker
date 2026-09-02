/**
 * App configuration constants
 */

export const RADIUS_PRESETS = [100, 200, 500, 1000, 2000] as const;
export type RadiusPreset = typeof RADIUS_PRESETS[number];

export const APP_CONFIG = {
  /** Default search radius in meters */
  DEFAULT_SEARCH_RADIUS_M: 200,

  /** Default destination zone radius in meters */
  DESTINATION_DEFAULT_RADIUS_M: 200,

  /** ETA auto-refresh interval in milliseconds */
  REFRESH_INTERVAL_MS: 30_000,
} as const;
