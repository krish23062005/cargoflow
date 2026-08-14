import type { Prisma } from "@/generated/prisma/client";
import type { Waypoint } from "@/lib/validators/route";
import { estimateEta, type EtaSample, type EtaWaypoint } from "@/lib/utils/eta-calculator";
import { broadcastToOrg } from "@/server/events";
import { notifyByPermission } from "@/server/notification";
import { formatEtaDuration } from "@/lib/utils/eta-calculator";

export type { EtaSample } from "@/lib/utils/eta-calculator";

/** Slim ETA payload attached to live tracking events and tRPC reads. */
export type EtaLive = {
  shipmentId: string;
  trackingNumber: string;
  status: string;
  remainingKm: number | null;
  minutes: number | null;
  /** ISO timestamp when the truck is predicted to arrive. */
  etaAt: string | null;
  isDelayed: boolean;
  /** Minutes predicted behind schedule (0 when on time, null if no target). */
  delayMin: number | null;
  speedUsedKmh: number | null;
};

/** Sample a prediction at most this often (10 min) per shipment. */
export const ETA_SAMPLE_INTERVAL_MS = 10 * 60_000;

export type LatestReading = {
  lat: number;
  lng: number;
  speedKmh: number | null;
  recordedAt: Date;
};

type EtaContext = {
  shipmentId: string;
  trackingNumber: string;
  status: string;
  estimatedDeliverAt: Date | null;
  vehicleId: string;
  waypoints: EtaWaypoint[];
};

/**
 * Resolve the ordered route (or origin → destination fallback when no route
 * template is attached) for every active shipment that has a running vehicle.
 */
export async function loadEtaContexts(
  prisma: Prisma.TransactionClient,
  organizationId: string,
  vehicleIds?: string[],
): Promise<EtaContext[]> {
  const shipments = await prisma.shipment.findMany({
    where: {
      organizationId,
      status: { in: ["PENDING_PICKUP", "PICKED_UP", "IN_TRANSIT", "AT_CHECKPOINT"] },
      assignment: { isNot: null },
      ...(vehicleIds ? { assignment: { vehicleId: { in: vehicleIds } } } : {}),
    },
    select: {
      id: true,
      trackingNumber: true,
      status: true,
      estimatedDeliverAt: true,
      originLat: true,
      originLng: true,
      destinationLat: true,
      destinationLng: true,
      assignment: { select: { vehicleId: true } },
      route: { select: { waypoints: true } },
    },
  });

  const contexts: EtaContext[] = [];
  for (const s of shipments) {
    const vehicleId = s.assignment?.vehicleId;
    if (!vehicleId) continue;

    let waypoints: EtaWaypoint[] | null = null;
    if (Array.isArray(s.route?.waypoints)) {
      waypoints = (s.route.waypoints as Waypoint[]).map((w) => ({
        lat: w.lat,
        lng: w.lng,
        type: w.type,
      }));
    } else if (
      s.originLat !== null &&
      s.originLng !== null &&
      s.destinationLat !== null &&
      s.destinationLng !== null
    ) {
      waypoints = [
        { lat: s.originLat, lng: s.originLng, type: "PICKUP" },
        { lat: s.destinationLat, lng: s.destinationLng, type: "DROPOFF" },
      ];
    }
    if (!waypoints || waypoints.length < 2) continue;

    contexts.push({
      shipmentId: s.id,
      trackingNumber: s.trackingNumber,
      status: s.status,
      estimatedDeliverAt: s.estimatedDeliverAt,
      vehicleId,
      waypoints,
    });
  }
  return contexts;
}

/**
 * Compute the live ETA map (vehicleId → EtaLive) for a fleet snapshot. Sample
 * speeds are fetched once for all involved vehicles to avoid an N+1.
 */
export async function computeOrgEtas(
  prisma: Prisma.TransactionClient,
  organizationId: string,
  latestByVehicle: Map<string, LatestReading>,
  contexts: EtaContext[],
): Promise<Map<string, EtaLive>> {
  const byVehicle = new Map<string, EtaLive>();

  const involvedVehicleIds = Array.from(
    new Set(contexts.filter((c) => c.vehicleId).map((c) => c.vehicleId)),
  );
  if (involvedVehicleIds.length === 0) return byVehicle;

  const since = new Date(Date.now() - 40 * 60_000);
  const recent = await prisma.trackingPoint.findMany({
    where: {
      organizationId,
      vehicleId: { in: involvedVehicleIds },
      recordedAt: { gte: since },
    },
    select: { vehicleId: true, speedKmh: true, recordedAt: true },
    orderBy: { recordedAt: "asc" },
  });
  const samplesByVehicle = new Map<string, EtaSample[]>();
  for (const p of recent) {
    const list = samplesByVehicle.get(p.vehicleId) ?? [];
    list.push({ speedKmh: p.speedKmh, recordedAt: p.recordedAt });
    samplesByVehicle.set(p.vehicleId, list);
  }

  for (const ctx of contexts) {
    const latest = latestByVehicle.get(ctx.vehicleId) ?? null;
    const start = latest ?? {
      lat: ctx.waypoints[0].lat,
      lng: ctx.waypoints[0].lng,
    };
    const result = estimateEta({
      waypoints: ctx.waypoints,
      start,
      samples: samplesByVehicle.get(ctx.vehicleId) ?? [],
      liveSpeedKmh: latest?.speedKmh ?? null,
    });

    const delayMin = delayVsTarget(
      result.etaAt,
      ctx.estimatedDeliverAt,
      ctx.status,
    );

    byVehicle.set(ctx.vehicleId, {
      shipmentId: ctx.shipmentId,
      trackingNumber: ctx.trackingNumber,
      status: ctx.status,
      remainingKm: result.remainingDistanceKm,
      minutes: result.totalMinutes,
      etaAt: result.etaAt.toISOString(),
      isDelayed: delayMin !== null && delayMin > 0,
      delayMin,
      speedUsedKmh: result.speedUsedKmh,
    });
  }

  return byVehicle;
}

/** Predicted-arrival vs promised-delivery difference (minutes, null = n/a). */
function delayVsTarget(
  etaAt: Date,
  target: Date | null,
  status: string,
): number | null {
  if (!target || status === "PENDING_PICKUP") return null;
  return Math.round((etaAt.getTime() - target.getTime()) / 60_000);
}

/**
 * Full ETA for one shipment, used by the shipment detail page. Reuses the same
 * estimation so popups, detail and portal all agree on the numbers.
 */
export async function getShipmentEta(
  prisma: Prisma.TransactionClient,
  organizationId: string,
  shipmentId: string,
): Promise<{ shipmentId: string; eta: EtaLive | null }> {
  const contexts = await loadEtaContexts(prisma, organizationId);
  const ctx = contexts.find((c) => c.shipmentId === shipmentId);
  if (!ctx) return { shipmentId, eta: null };

  const latest = await prisma.trackingPoint.findFirst({
    where: { organizationId, vehicleId: ctx.vehicleId },
    orderBy: { recordedAt: "desc" },
  });
  const latestByVehicle = new Map<string, LatestReading>();
  if (latest) latestByVehicle.set(ctx.vehicleId, latest);

  const etaMap = await computeOrgEtas(prisma, organizationId, latestByVehicle, [ctx]);
  return { shipmentId, eta: etaMap.get(ctx.vehicleId) ?? null };
}

/**
 * Recompute ETA after a tracking ingest for the affected vehicles. Records a
 * throttled prediction sample (EtaPrediction), detects delays and broadcasts a
 * live `eta` / `eta_delayed` event so open dashboards react in real time.
 *
 * Returns the fresh ETA (or null) per affected vehicle.
 */
export async function recomputeEtasForVehicles(
  prisma: Prisma.TransactionClient,
  organizationId: string,
  vehicleIds: string[],
): Promise<Map<string, EtaLive>> {
  const unique = Array.from(new Set(vehicleIds));
  if (unique.length === 0) return new Map();

  const contexts = await loadEtaContexts(prisma, organizationId, unique);
  if (contexts.length === 0) return new Map();

  // Latest per vehicle.
  const latestRaw = await prisma.trackingPoint.findMany({
    where: {
      organizationId,
      vehicleId: { in: unique },
    },
    select: { vehicleId: true, lat: true, lng: true, speedKmh: true, recordedAt: true },
    orderBy: { recordedAt: "desc" },
  });
  // De-duplicate to one row per vehicle (query above may return one each).
  const latestByVehicle = new Map<string, LatestReading>();
  for (const p of latestRaw) {
    if (!latestByVehicle.has(p.vehicleId)) {
      latestByVehicle.set(p.vehicleId, {
        lat: p.lat,
        lng: p.lng,
        speedKmh: p.speedKmh,
        recordedAt: p.recordedAt,
      });
    }
  }

  const etaMap = await computeOrgEtas(prisma, organizationId, latestByVehicle, contexts);

  for (const ctx of contexts) {
    const live = etaMap.get(ctx.vehicleId);
    if (!live) continue;
    await recordSample(prisma, organizationId, ctx, live);
    if (live.isDelayed) {
      broadcastToOrg(organizationId, "eta_delayed", {
        shipmentId: ctx.shipmentId,
        trackingNumber: ctx.trackingNumber,
        etaAt: live.etaAt,
        delayMin: live.delayMin,
      });
      void notifyByPermission(prisma, {
        organizationId,
        type: "VEHICLE_ALERT",
        title: `${ctx.trackingNumber} is running late`,
        body: live.delayMin != null
          ? `Predicted arrival ${formatEtaDuration(live.minutes)} from now — ${live.delayMin} min behind the promised delivery.`
          : `Predicted arrival ${formatEtaDuration(live.minutes)} from now.`,
        link: `/shipments/${ctx.shipmentId}`,
      });
    }
    broadcastToOrg(organizationId, "eta", live);
  }

  return etaMap;
}

/** Write a throttled EtaPrediction row (max one per shipment/10 min). */
async function recordSample(
  prisma: Prisma.TransactionClient,
  organizationId: string,
  ctx: EtaContext,
  live: EtaLive,
): Promise<void> {
  const last = await prisma.etaPrediction.findFirst({
    where: { shipmentId: ctx.shipmentId },
    orderBy: { predictedAt: "desc" },
  });

  const withinWindow =
    last !== null && Date.now() - last.predictedAt.getTime() < ETA_SAMPLE_INTERVAL_MS;

  // Only persist when something meaningful changed (delay flip or window pass).
  if (withinWindow && last?.isDelayed === live.isDelayed) {
    return;
  }

  try {
    await prisma.etaPrediction.create({
      data: {
        organizationId,
        shipmentId: ctx.shipmentId,
        vehicleId: ctx.vehicleId,
        status: ctx.status,
        remainingKm: live.remainingKm ?? null,
        predictedMinutes: live.minutes ?? null,
        etaAt: live.etaAt ? new Date(live.etaAt) : null,
        speedUsedKmh: live.speedUsedKmh ?? null,
        isDelayed: live.isDelayed,
      },
    });
  } catch {
    // Sampling must never break the ingest path.
  }
}

/**
 * When a shipment is delivered, stamp the real arrival time onto its open
 * predictions so predicted-vs-actual accuracy can be measured later.
 */
export async function stampDeliveredAt(
  prisma: Prisma.TransactionClient,
  organizationId: string,
  shipmentId: string,
  actualDeliveredAt: Date,
): Promise<number> {
  const update = await prisma.etaPrediction.updateMany({
    where: { organizationId, shipmentId, actualDeliveredAt: null },
    data: { actualDeliveredAt },
  });
  return update.count;
}