export const MOVING_THRESHOLD_KMH = 5;
export const NEAR_WAYPOINT_METERS = 500;

const INTERVAL_MOVING_MS = 10_000;
const INTERVAL_STOPPED_MS = 60_000;
const INTERVAL_NEAR_WAYPOINT_MS = 5_000;

/**
 * Report interval for the driver app given current speed and distance to the
 * next waypoint. Far from any waypoint and moving → 10s; stopped → 60s; near a
 * waypoint → 5s. Lives in `lib/utils` so both the server ingest route and the
 * client-side geolocation reporter share one source of truth.
 */
export function smartReportingIntervalMs(options: {
  speedKmh: number | null | undefined;
  distanceToWaypointMeters: number | null | undefined;
}): number {
  const nearWaypoint =
    options.distanceToWaypointMeters !== null &&
    options.distanceToWaypointMeters !== undefined &&
    options.distanceToWaypointMeters < NEAR_WAYPOINT_METERS;

  const moving = (options.speedKmh ?? 0) > MOVING_THRESHOLD_KMH && !nearWaypoint;

  if (moving) return INTERVAL_MOVING_MS;
  if (nearWaypoint) return INTERVAL_NEAR_WAYPOINT_MS;
  return INTERVAL_STOPPED_MS;
}

/** Great-circle distance in meters between two lat/lng points. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}