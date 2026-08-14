/**
 * Pure ETA math — no I/O, browser-safe (imported from both tRPC services and
 * client components). Uses Africa-plausible defaults: freight trucks rarely
 * cruise above ~80 km/h and border queues are the biggest scheduling killer.
 */

/** Distance (km) per hour a truck actually averages over a whole trip. */
export const DEFAULT_AVG_SPEED_KMH = 60;
export const MIN_SPEED_KMH = 10;
export const MAX_SPEED_KMH = 90;

/** Great-circle distance between two coordinates in kilometres. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Wall-clock multiplier by hour-of-day. Rush-hour Lagos/Accra traffic and
 * night-time toll gates both slow trucks down; modelling them as a ±30%
 * duration factor keeps the estimate honest without a traffic feed.
 */
export const TIME_OF_DAY_FACTORS: { startHour: number; factor: number }[] = [
  { startHour: 0, factor: 1.15 }, // overnight tolls / security / curfews
  { startHour: 6, factor: 1.25 }, // early rush
  { startHour: 10, factor: 1.0 }, // mid-morning → afternoon
  { startHour: 17, factor: 1.3 }, // evening rush
  { startHour: 21, factor: 1.1 }, // late evening
];

function timeOfDayFactor(date: Date): number {
  const hour = date.getHours();
  let factor = 1.0;
  for (const band of TIME_OF_DAY_FACTORS) {
    if (hour >= band.startHour) factor = band.factor;
  }
  return factor;
}

/**
 * Scheduled dwell time (minutes) before continuing from a waypoint. The final
 * dropoff is excluded (the ETA is *arrival at the gate*, not post-unload).
 * Pickup delay only applies when the truck hasn't left origin, which the
 * remaining-distance projection already accounts for.
 */
export const WAYPOINT_DELAY_MINUTES: Record<string, number> = {
  BORDER_CROSSING: 60,
  CHECKPOINT: 15,
  FUEL_STOP: 12,
  REST_STOP: 20,
  PICKUP: 20,
  DROPOFF: 0,
};

export function waypointDelayMinutes(type: string): number {
  return WAYPOINT_DELAY_MINUTES[type] ?? 10;
}

export type EtaWaypoint = {
  lat: number;
  lng: number;
  type: string;
};

export type EtaSample = {
  speedKmh: number | null;
  recordedAt: Date;
};

/**
 * Mean of recent *moving* speeds (a parked truck at 0 km/h must not drag the
 * average to zero). Falls back to the live speed then a sane truck default.
 */
export function averageSpeedKmh(samples: EtaSample[], liveSpeedKmh: number | null): number {
  const moving = samples
    .map((s) => s.speedKmh)
    .filter((s): s is number => s !== null && s !== undefined && s >= 5);
  const candidate = moving.length > 0
    ? moving.reduce((sum, s) => sum + s, 0) / moving.length
    : (liveSpeedKmh ?? DEFAULT_AVG_SPEED_KMH);
  return clampSpeed(candidate);
}

function clampSpeed(kmh: number): number {
  if (!Number.isFinite(kmh)) return DEFAULT_AVG_SPEED_KMH;
  return Math.min(MAX_SPEED_KMH, Math.max(MIN_SPEED_KMH, kmh));
}

/**
 * Distance remaining to the final waypoint, using the truck's current position
 * snapped onto the route polyline. Works whether the truck is before the
 * origin, mid-route, or already past the destination (returns 0).
 */
export function remainingDistanceKm(
  start: { lat: number; lng: number },
  waypoints: EtaWaypoint[],
): number {
  if (waypoints.length < 2) return 0;

  const cumulative: number[] = [0];
  for (let i = 1; i < waypoints.length; i += 1) {
    cumulative[i] =
      cumulative[i - 1] + haversineKm(waypoints[i - 1].lat, waypoints[i - 1].lng, waypoints[i].lat, waypoints[i].lng);
  }
  const total = cumulative[cumulative.length - 1];

  // Snap the current position onto the nearest polyline segment and measure
  // how far along the chain that is.
  let bestOffset = 0;
  let bestCross = Infinity;
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const { along, cross } = projectOntoSegment(start, a, b);
    const offset = cumulative[i] + along;
    if (cross < bestCross) {
      bestCross = cross;
      bestOffset = offset;
    }
  }

  let remaining = total - bestOffset;
  if (remaining < 0) remaining = 0;
  // Truck not yet on the polyline (before origin): add the gap to wp[0].
  if (bestOffset === 0) remaining += haversineKm(start.lat, start.lng, waypoints[0].lat, waypoints[0].lng);
  return remaining;
}

/** Project `p` onto segment `a→b`. Returns km from `a` and perpendicular km. */
function projectOntoSegment(
  p: { lat: number; lng: number },
  a: EtaWaypoint,
  b: EtaWaypoint,
): { along: number; cross: number } {
  const x1 = a.lng;
  const y1 = a.lat;
  const x2 = b.lng;
  const y2 = b.lat;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return { along: 0, cross: haversineKm(p.lat, p.lng, a.lat, a.lng) };
  }
  // Project in lng/lat space; convert the planar ratios to km via the segment
  // length so it stays metric-friendly for typical GPS deltas.
  const t = Math.max(0, Math.min(1, ((p.lng - x1) * dx + (p.lat - y1) * dy) / lenSq));
  const projLat = y1 + t * dy;
  const projLng = x1 + t * dx;
  const segLen = haversineKm(a.lat, a.lng, b.lat, b.lng);
  const along = t * segLen;
  const cross = haversineKm(p.lat, p.lng, projLat, projLng);
  // Rough planar→metric correction for the along component.
  return { along, cross };
}

/** Dwell time (minutes) for every waypoint still ahead of the truck. */
export function remainingDelayMinutes(
  start: { lat: number; lng: number },
  waypoints: EtaWaypoint[],
): { minutes: number; count: number } {
  if (waypoints.length < 2) return { minutes: 0, count: 0 };
  const cumulative: number[] = [0];
  for (let i = 1; i < waypoints.length; i += 1) {
    cumulative[i] =
      cumulative[i - 1] + haversineKm(waypoints[i - 1].lat, waypoints[i - 1].lng, waypoints[i].lat, waypoints[i].lng);
  }
  // Same snapping as remainingDistanceKm; reuse a compact projection pass.
  let bestOffset = 0;
  let bestCross = Infinity;
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const { along, cross } = projectOntoSegment(start, waypoints[i], waypoints[i + 1]);
    const offset = cumulative[i] + along;
    if (cross < bestCross) {
      bestCross = cross;
      bestOffset = offset;
    }
  }

  let minutes = 0;
  let count = 0;
  for (let i = 0; i < waypoints.length; i += 1) {
    if (cumulative[i] + 1e-9 < bestOffset) continue; // behind the truck
    if (i === waypoints.length - 1) continue; // arrival at the dropoff
    const delay = waypointDelayMinutes(waypoints[i].type);
    minutes += delay;
    count += 1;
  }
  return { minutes, count };
}

export type EtaResult = {
  /** Full distance still to travel along the route, in km. */
  remainingDistanceKm: number;
  /** Pure drive time (distance ÷ speed × time-of-day factor), in minutes. */
  travelMinutes: number;
  /** Scheduled dwell time at ahead waypoints, in minutes. */
  waypointDelayMinutes: number;
  /** travel + dwell, in minutes. */
  totalMinutes: number;
  /** Clock time the truck is predicted to arrive. */
  etaAt: Date;
  /** Average speed the prediction was based on, in km/h. */
  speedUsedKmh: number;
  /** When the estimate was made. */
  computedAt: Date;
};

/**
 * One-stop ETA estimate for a truck on a route.
 *
 * @param waypoints ordered route polyline (pickup → dropoff)
 * @param start the truck's current position (falls back to origin)
 * @param samples recent tracking readings used to derive average speed
 * @param liveSpeedKmh the most recent raw speed, used when samples are sparse
 * @param from wall-clock reference; defaults to now
 */
export function estimateEta(args: {
  waypoints: EtaWaypoint[];
  start: { lat: number; lng: number };
  samples: EtaSample[];
  liveSpeedKmh: number | null;
  from?: Date;
}): EtaResult {
  const from = args.from ?? new Date();
  const speed = averageSpeedKmh(args.samples, args.liveSpeedKmh);

  const remaining = remainingDistanceKm(args.start, args.waypoints);
  const dwell = remainingDelayMinutes(args.start, args.waypoints);

  const tod = timeOfDayFactor(from);
  const travelMinutes = (remaining / speed) * 60 * tod;
  const totalMinutes = travelMinutes + dwell.minutes;
  const etaAt = new Date(from.getTime() + Math.round(totalMinutes) * 60_000);

  return {
    remainingDistanceKm: Math.round(remaining * 10) / 10,
    travelMinutes: Math.round(travelMinutes),
    waypointDelayMinutes: dwell.minutes,
    totalMinutes: Math.round(totalMinutes),
    etaAt,
    speedUsedKmh: Math.round(speed * 10) / 10,
    computedAt: from,
  };
}

/** Compact "in X hr Y min" label for map popups. */
export function formatEtaDuration(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return "—";
  const clamped = Math.max(0, Math.round(min));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}