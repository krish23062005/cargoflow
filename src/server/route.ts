import type { Waypoint } from "@/lib/validators/route";

export type RouteCalculation = {
  totalDistanceKm: number;
  estimatedDurationMin: number;
  /** Ordered polyline points as [lat, lng] pairs (leaflet-ready). */
  geometry: [number, number][];
  provider: "osrm" | "haversine";
};

const OSRM_BASE_URL = process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";
const OSRM_TIMEOUT_MS = 9000;
const DEFAULT_AVG_SPEED_KMH = 60;

/**
 * Runs a car route through OSRM for a set of ordered waypoints and returns
 * distance, duration and a full geometry polyline. Falls back to a straight
 * haversine "as the crow flies" estimate if the public OSRM server is
 * unreachable (rural Africa, firewalls, outage) so planning never dead-ends.
 */
export async function calculateRoute(waypoints: Waypoint[]): Promise<RouteCalculation> {
  try {
    return await osrmRoute(waypoints);
  } catch {
    return haversineRoute(waypoints);
  }
}

async function osrmRoute(waypoints: Waypoint[]): Promise<RouteCalculation> {
  const coordinates = waypoints.map((w) => `${w.lng.toFixed(6)},${w.lat.toFixed(6)}`);
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates.join(
    ";",
  )}?overview=full&geometries=geojson&steps=false&alternatives=false`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`OSRM responded with ${res.status}`);
    }
    const data = (await res.json()) as {
      code?: string;
      routes?: { distance?: number; duration?: number; geometry?: { coordinates?: number[][] } }[];
    };
    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error("OSRM returned no route");
    }
    const route = data.routes[0];
    const coords = (route.geometry?.coordinates ?? [])
      .map(([lon, lat]) => [lat, lon] as [number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

    return {
      totalDistanceKm: Math.round(((route.distance ?? 0) / 1000) * 10) / 10,
      estimatedDurationMin: Math.round((route.duration ?? 0) / 60),
      geometry: coords,
      provider: "osrm",
    };
  } finally {
    clearTimeout(timer);
  }
}

function haversineRoute(waypoints: Waypoint[]): RouteCalculation {
  let distanceKm = 0;
  for (let i = 1; i < waypoints.length; i += 1) {
    distanceKm += haversineKm(
      waypoints[i - 1].lat,
      waypoints[i - 1].lng,
      waypoints[i].lat,
      waypoints[i].lng,
    );
  }
  const rounded = Math.round(distanceKm * 10) / 10;
  return {
    totalDistanceKm: rounded,
    estimatedDurationMin: Math.round((rounded / DEFAULT_AVG_SPEED_KMH) * 60),
    geometry: waypoints.map((w) => [w.lat, w.lng] as [number, number]),
    provider: "haversine",
  };
}

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