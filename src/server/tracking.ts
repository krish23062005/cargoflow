import { Prisma } from "@/generated/prisma/client";
import type { TrackingPointInput } from "@/lib/validators/tracking";
import { broadcastToOrg } from "@/server/events";
import {
  computeOrgEtas,
  loadEtaContexts,
  type EtaLive,
} from "@/server/eta";

/**
 * Live GPS tracking.
 *
 * The driver PWA reports positions in batches (see `ingestPoints`); the
 * dashboard receives live updates over SSE (`broadcast`). This module owns the
 * in-memory broadcast hub (org-scoped), latest-position snapshot logic, and
 * the smart reporting-interval rules that conserve bandwidth/battery where
 * data is expensive (the #3 architectural decision).
 */

/* ------------------------------------------------------------------ */
/* Smart reporting intervals                                          */
/* ------------------------------------------------------------------ */

export {
  MOVING_THRESHOLD_KMH,
  NEAR_WAYPOINT_METERS,
  smartReportingIntervalMs,
} from "@/lib/utils/reporting-interval";

/* ------------------------------------------------------------------ */
/* Broadcast hub (single Next.js process / dev + demo)                */
/* ------------------------------------------------------------------ */

/**
 * Backwards-compatible aliases for the shared realtime hub (src/server/events.ts).
 * The hub lives in its own module so the ETA service can publish without
 * creating an import cycle.
 */
export { subscribeToOrg as subscribeTracking, broadcastToOrg as broadcast } from "@/server/events";

/* ------------------------------------------------------------------ */
/* Snapshot queries                                                   */
/* ------------------------------------------------------------------ */

/**
 * A vehicle's live view: identifying fields plus its most recent reading.
 */
export type VehicleLive = {
  vehicleId: string;
  plateNumber: string;
  make: string | null;
  model: string | null;
  status: string;
  driverName: string | null;
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  headingDeg: number | null;
  accuracyM: number | null;
  source: string | null;
  recordedAt: Date | null;
  /** Live ETA for this vehicle's active shipment, when one exists. */
  eta: EtaLive | null;
};

const vehicleLiveSelect = {
  id: true,
  plateNumber: true,
  make: true,
  model: true,
  status: true,
} satisfies Prisma.VehicleSelect;

export function toVehicleLive(
  vehicle: {
    id: string;
    plateNumber: string;
    make: string | null;
    model: string | null;
    status: string;
  },
  extras?: {
    driverName?: string | null;
    eta?: EtaLive | null;
    latest?: {
      lat: number;
      lng: number;
      speedKmh: number | null;
      headingDeg: number | null;
      accuracyM: number | null;
      source: string | null;
      recordedAt: Date;
    } | null;
  },
): VehicleLive {
  const p = extras?.latest;
  return {
    vehicleId: vehicle.id,
    plateNumber: vehicle.plateNumber,
    make: vehicle.make,
    model: vehicle.model,
    status: vehicle.status,
    driverName: extras?.driverName ?? null,
    lat: p?.lat ?? null,
    lng: p?.lng ?? null,
    speedKmh: p?.speedKmh ?? null,
    headingDeg: p?.headingDeg ?? null,
    accuracyM: p?.accuracyM ?? null,
    source: p?.source ?? null,
    recordedAt: p?.recordedAt ?? null,
    eta: extras?.eta ?? null,
  };
}

/**
 * Latest position snapshot for every vehicle in an organization. Used both for
 * the SSE initial burst and the tRPC `live` query.
 *
 * Vehicles, their active assignment's driver, and the newest tracking point
 * per vehicle are fetched in parallel to avoid N+1 queries.
 */
export async function getOrgLive(
  prisma: Prisma.TransactionClient,
  organizationId: string,
) {
  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId },
    select: vehicleLiveSelect,
  });
  if (vehicles.length === 0) return [];

  // Active assignment → driver name for each vehicle (dedup).
  const assignments = await prisma.vehicleAssignment.findMany({
    where: { organizationId, status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    select: {
      vehicleId: true,
      driver: { select: { name: true } },
    },
  });
  const driverByVehicle = new Map<string, string | null>();
  for (const a of assignments) {
    if (!driverByVehicle.has(a.vehicleId)) driverByVehicle.set(a.vehicleId, a.driver.name);
  }

  // Most recent tracking point per vehicle via a window function.
  const latestRaw = await prisma.$queryRaw<
    {
      vehicleId: string;
      lat: number;
      lng: number;
      speedKmh: number | null;
      headingDeg: number | null;
      accuracyM: number | null;
      source: string | null;
      recordedAt: Date;
    }[]
  >`
    SELECT "vehicleId", lat, lng, "speedKmh", "headingDeg", "accuracyM", source, "recordedAt"
    FROM (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY "vehicleId"
          ORDER BY "recordedAt" DESC
        ) AS rn
      FROM "TrackingPoint"
      WHERE "vehicleId" IN (${Prisma.join(vehicles.map((v) => v.id))})
    ) t
    WHERE rn = 1
  `;
  const latestByVehicle = new Map(latestRaw.map((p) => [p.vehicleId, p]));

  // Live ETA per vehicle (only for vehicles running an active shipment).
  const etaContexts = await loadEtaContexts(prisma, organizationId);
  const etaByVehicle = await computeOrgEtas(prisma, organizationId, latestByVehicle, etaContexts);

  return vehicles.map((v) =>
    toVehicleLive(v, {
      driverName: driverByVehicle.get(v.id) ?? null,
      latest: latestByVehicle.get(v.id) ?? null,
      eta: etaByVehicle.get(v.id) ?? null,
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Ingest (driver PWA reporter)                                       */
/* ------------------------------------------------------------------ */

/**
 * Validate + store a batch of tracking points and broadcast the new readings.
 * Points referencing unknown vehicles (or vehicles outside the org) are
 * dropped with a CONFLICT-friendly error. Returns a mapping of vehicleId →
 * latest stored point so the reporter can prune/confirm.
 */
export async function ingestPoints(args: {
  prisma: Prisma.TransactionClient;
  organizationId: string;
  points: TrackingPointInput[];
}) {
  const { prisma, organizationId, points } = args;

  const vehicleIds = Array.from(new Set(points.map((p) => p.vehicleId)));
  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId, id: { in: vehicleIds } },
    select: { id: true },
  });
  const validVehicleIds = new Set(vehicles.map((v) => v.id));

  const tracked: TrackingPointInput[] = [];
  const skipped: string[] = [];
  for (const point of points) {
    if (!validVehicleIds.has(point.vehicleId)) {
      skipped.push(point.vehicleId);
      continue;
    }
    tracked.push(point);
  }

  if (tracked.length === 0) {
    return { stored: 0, vehicles: [] };
  }

  const stored = await prisma.trackingPoint.createMany({
    data: tracked.map((p) => ({
      organizationId,
      vehicleId: p.vehicleId,
      lat: p.lat,
      lng: p.lng,
      speedKmh: p.speedKmh ?? null,
      headingDeg: p.headingDeg ?? null,
      accuracyM: p.accuracyM ?? null,
      source: p.source ?? "PWA",
      recordedAt: p.recordedAt ?? new Date(),
    })),
  });

  // Republish the org snapshot so every open dashboard updates.
  const orgLive = await getOrgLive(prisma, organizationId);
  broadcastToOrg(organizationId, "positions", {
    vehicles: orgLive,
  });

  return {
    stored: stored.count,
    skipped,
    vehicles: orgLive,
  };
}