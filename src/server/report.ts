import { prisma } from "@/lib/db";
import type { Shipment, Vehicle, Driver, VehicleAssignment } from "@/generated/prisma/client";

export type ReportRange = { from: Date; to: Date };

const DEFAULT_RANGE_DAYS = 30;

/** Resolve an optional date range; defaults to the last 30 days. */
export function resolveRange(from?: Date | null, to?: Date | null): ReportRange {
  const toDate = to ?? new Date();
  const fromDate = from ?? new Date(toDate.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  return { from: fromDate, to: toDate };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function clamp100(n: number): number {
  return Math.min(100, Math.max(0, n));
}

type ShipmentForReport = Pick<
  Shipment,
  | "id"
  | "status"
  | "customerName"
  | "createdAt"
  | "actualDeliveredAt"
  | "estimatedDeliverAt"
  | "originLat"
  | "originLng"
  | "destinationLat"
  | "destinationLng"
> & {
  assignment: (Pick<VehicleAssignment, "id"> & { driver: Pick<Driver, "id" | "name"> | null }) | null;
  route: { name: string | null } | null;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Fleet utilization                                                   */
/* ------------------------------------------------------------------ */

export async function getFleetUtilization(range: ReportRange, organizationId: string) {
  const assignments = await prisma.vehicleAssignment.findMany({
    where: {
      organizationId,
      startDate: { lte: range.to },
      OR: [{ endDate: null }, { endDate: { gte: range.from } }],
    },
    select: {
      id: true,
      vehicleId: true,
      startDate: true,
      endDate: true,
      vehicle: { select: { id: true, plateNumber: true, make: true, model: true, status: true } },
    },
  });

  const rangeMs = Math.max(1, range.to.getTime() - range.from.getTime());
  const byVehicle = new Map<string, { vehicle: Vehicle; activeMs: number; trips: number }>();

  for (const a of assignments) {
    const start = a.startDate.getTime() < range.from.getTime() ? range.from.getTime() : a.startDate.getTime();
    const end = a.endDate ? a.endDate.getTime() : range.to.getTime();
    const overlap = Math.min(end, range.to.getTime()) - start;
    const entry = byVehicle.get(a.vehicleId) ?? {
      vehicle: a.vehicle as unknown as Vehicle,
      activeMs: 0,
      trips: 0,
    };
    entry.activeMs += Math.max(0, overlap);
    entry.trips += 1;
    byVehicle.set(a.vehicleId, entry);
  }

  return [...byVehicle.values()]
    .map(({ vehicle, activeMs, trips }) => ({
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      make: vehicle.make,
      model: vehicle.model,
      status: vehicle.status,
      trips,
      activeDays: round1(activeMs / (24 * 60 * 60 * 1000)),
      rangeDays: round1(rangeMs / (24 * 60 * 60 * 1000)),
      utilizationPct: round1(clamp100((activeMs / rangeMs) * 100)),
    }))
    .sort((a, b) => b.utilizationPct - a.utilizationPct);
}

/* ------------------------------------------------------------------ */
/* Delivery performance                                                */
/* ------------------------------------------------------------------ */

async function getDeliveredInRange(range: ReportRange, organizationId: string): Promise<ShipmentForReport[]> {
  const shipments = await prisma.shipment.findMany({
    where: {
      organizationId,
      status: "DELIVERED",
      actualDeliveredAt: { gte: range.from, lte: range.to },
    },
    select: {
      id: true,
      status: true,
      customerName: true,
      createdAt: true,
      actualDeliveredAt: true,
      estimatedDeliverAt: true,
      originLat: true,
      originLng: true,
      destinationLat: true,
      destinationLng: true,
      assignment: { select: { id: true, driver: { select: { id: true, name: true } } } },
      route: { select: { name: true } },
    },
  });
  return shipments as ShipmentForReport[];
}

function deliveryStats(shipments: ShipmentForReport[]) {
  const withEstimate = shipments.filter((s) => s.estimatedDeliverAt && s.actualDeliveredAt);
  const onTime = withEstimate.filter((s) => s.actualDeliveredAt! <= s.estimatedDeliverAt!);
  const late = withEstimate.filter((s) => s.actualDeliveredAt! > s.estimatedDeliverAt!);
  const avgDelayMinutes = late.length
    ? Math.round(
        late.reduce(
          (acc, s) => acc + (s.actualDeliveredAt!.getTime() - s.estimatedDeliverAt!.getTime()) / 60000,
          0,
        ) / late.length,
      )
    : 0;
  return {
    delivered: shipments.length,
    withEstimate: withEstimate.length,
    onTime: onTime.length,
    late: late.length,
    onTimePct: withEstimate.length ? round1((onTime.length / withEstimate.length) * 100) : 0,
    avgDelayMinutes,
  };
}

export async function getDeliveryPerformance(range: ReportRange, organizationId: string) {
  const delivered = await getDeliveredInRange(range, organizationId);

  const byDriverMap = new Map<string, ShipmentForReport[]>();
  for (const s of delivered) {
    const driverName = s.assignment?.driver?.name ?? "Unassigned";
    byDriverMap.set(driverName, [...(byDriverMap.get(driverName) ?? []), s]);
  }
  const byRouteMap = new Map<string, ShipmentForReport[]>();
  for (const s of delivered) {
    const routeName = s.route?.name ?? "No route";
    byRouteMap.set(routeName, [...(byRouteMap.get(routeName) ?? []), s]);
  }

  return {
    overall: deliveryStats(delivered),
    byDriver: [...byDriverMap.entries()]
      .map(([driverName, list]) => ({ driverName, ...deliveryStats(list) }))
      .sort((a, b) => b.delivered - a.delivered),
    byRoute: [...byRouteMap.entries()]
      .map(([routeName, list]) => ({ routeName, ...deliveryStats(list) }))
      .sort((a, b) => b.delivered - a.delivered),
  };
}

/* ------------------------------------------------------------------ */
/* Driver scorecard                                                    */
/* ------------------------------------------------------------------ */

export async function getDriverScorecard(range: ReportRange, organizationId: string) {
  const drivers = await prisma.driver.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      status: true,
      assignments: {
        where: {
          shipments: {
            some: { status: "DELIVERED", actualDeliveredAt: { gte: range.from, lte: range.to } },
          },
        },
        select: {
          id: true,
          shipments: {
            where: { status: "DELIVERED", actualDeliveredAt: { gte: range.from, lte: range.to } },
            select: {
              id: true,
              actualDeliveredAt: true,
              estimatedDeliverAt: true,
              originLat: true,
              originLng: true,
              destinationLat: true,
              destinationLng: true,
            },
          },
        },
      },
    },
  });

  return drivers
    .map((driver) => {
      const completed = driver.assignments.flatMap((a) => a.shipments);
      const withEstimate = completed.filter((s) => s.estimatedDeliverAt && s.actualDeliveredAt);
      const onTime = withEstimate.filter((s) => s.actualDeliveredAt! <= s.estimatedDeliverAt!);
      const distanceKm = completed.reduce(
        (acc, s) =>
          acc +
          (s.originLat != null &&
          s.originLng != null &&
          s.destinationLat != null &&
          s.destinationLng != null
            ? haversineKm(s.originLat, s.originLng, s.destinationLat, s.destinationLng)
            : 0),
        0,
      );
      return {
        driverId: driver.id,
        name: driver.name,
        status: driver.status,
        trips: completed.length,
        onTimePct: withEstimate.length ? round1((onTime.length / withEstimate.length) * 100) : 0,
        distanceKm: round1(distanceKm),
      };
    })
    .filter((d) => d.trips > 0)
    .sort((a, b) => b.trips - a.trips);
}

/* ------------------------------------------------------------------ */
/* Cost analysis (placeholder data until finance integrations land)    */
/* ------------------------------------------------------------------ */

const FUEL_COST_PER_KM = 0.42; // placeholder USD
const MAINTENANCE_FIXED = 85; // placeholder USD per vehicle per range
const MAINTENANCE_PER_KM = 0.06;

export async function getCostAnalysis(range: ReportRange, organizationId: string) {
  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId },
    select: {
      id: true,
      plateNumber: true,
      make: true,
      model: true,
      assignments: {
        where: {
          shipments: {
            some: { actualDeliveredAt: { gte: range.from, lte: range.to } },
          },
        },
        select: {
          shipments: {
            where: { actualDeliveredAt: { gte: range.from, lte: range.to } },
            select: {
              id: true,
              originLat: true,
              originLng: true,
              destinationLat: true,
              destinationLng: true,
            },
          },
        },
      },
    },
  });

  const rows = vehicles.map((vehicle) => {
    const distanceKm = vehicle.assignments
      .flatMap((a) => a.shipments)
      .reduce(
        (acc, s) =>
          acc +
          (s.originLat != null &&
          s.originLng != null &&
          s.destinationLat != null &&
          s.destinationLng != null
            ? haversineKm(s.originLat, s.originLng, s.destinationLat, s.destinationLng)
            : 0),
        0,
      );
    const fuelCost = round1(distanceKm * FUEL_COST_PER_KM);
    const maintenanceCost = round1(MAINTENANCE_FIXED + distanceKm * MAINTENANCE_PER_KM);
    return {
      vehicleId: vehicle.id,
      plateNumber: vehicle.plateNumber,
      make: vehicle.make,
      model: vehicle.model,
      distanceKm: round1(distanceKm),
      fuelCost,
      maintenanceCost,
      totalCost: round1(fuelCost + maintenanceCost),
    };
  });

  const totalCost = round1(rows.reduce((acc, r) => acc + r.totalCost, 0));
  return { placeholder: true, totalCost, rows: rows.sort((a, b) => b.totalCost - a.totalCost) };
}

/* ------------------------------------------------------------------ */
/* Shipment summary                                                    */
/* ------------------------------------------------------------------ */

const STATUS_COLORS: Record<string, string> = {
  PENDING_PICKUP: "#94a3b8",
  PICKED_UP: "#38bdf8",
  IN_TRANSIT: "#818cf8",
  AT_CHECKPOINT: "#f59e0b",
  DELIVERED: "#22c55e",
  CANCELLED: "#ef4444",
  RETURNED: "#a855f7",
};

export async function getShipmentSummary(range: ReportRange, organizationId: string) {
  const shipments = await prisma.shipment.findMany({
    where: {
      organizationId,
      createdAt: { gte: range.from, lte: range.to },
    },
    select: {
      id: true,
      status: true,
      customerName: true,
      createdAt: true,
      cargoType: true,
    },
  });

  const byStatus: { status: string; count: number; color: string }[] = [];
  const statusMap = new Map<string, number>();
  for (const s of shipments) {
    statusMap.set(s.status, (statusMap.get(s.status) ?? 0) + 1);
  }
  for (const [status, count] of statusMap) {
    byStatus.push({ status, count, color: STATUS_COLORS[status] ?? "#64748b" });
  }
  byStatus.sort((a, b) => b.count - a.count);

  const byCustomer: { customerName: string; count: number }[] = [];
  const customerMap = new Map<string, number>();
  for (const s of shipments) {
    const name = s.customerName || "Unknown";
    customerMap.set(name, (customerMap.get(name) ?? 0) + 1);
  }
  for (const [customerName, count] of customerMap) {
    byCustomer.push({ customerName, count });
  }
  byCustomer.sort((a, b) => b.count - a.count);
  const topCustomers = byCustomer.slice(0, 10);

  const byCargoType: { cargoType: string; count: number }[] = [];
  const cargoMap = new Map<string, number>();
  for (const s of shipments) {
    cargoMap.set(s.cargoType, (cargoMap.get(s.cargoType) ?? 0) + 1);
  }
  for (const [cargoType, count] of cargoMap) {
    byCargoType.push({ cargoType, count });
  }
  byCargoType.sort((a, b) => b.count - a.count);

  // Daily volume over the range, gaps filled with zeros.
  const perDayMap = new Map<string, number>();
  for (const s of shipments) {
    const key = s.createdAt.toISOString().slice(0, 10);
    perDayMap.set(key, (perDayMap.get(key) ?? 0) + 1);
  }
  const byPeriod: { date: string; count: number }[] = [];
  const cursor = new Date(range.from);
  const end = new Date(range.to);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    byPeriod.push({ date: key, count: perDayMap.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const spanDays = (end.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays > 60) {
    // Bucket daily rows into weeks for very long ranges.
    const weekly: { date: string; count: number }[] = [];
    for (let i = 0; i < byPeriod.length; i += 7) {
      const chunk = byPeriod.slice(i, i + 7);
      weekly.push({ date: chunk[0]!.date, count: chunk.reduce((a, b) => a + b.count, 0) });
    }
    return {
      total: shipments.length,
      byStatus,
      byCustomer: topCustomers,
      byCargoType,
      byPeriod: weekly,
      periodBucket: "weekly",
    };
  }

  return {
    total: shipments.length,
    byStatus,
    byCustomer: topCustomers,
    byCargoType,
    byPeriod,
    periodBucket: "daily",
  };
}

/* ------------------------------------------------------------------ */
/* Overview snapshot (dashboard widgets)                               */
/* ------------------------------------------------------------------ */

export async function getReportOverview(range: ReportRange, organizationId: string) {
  const [vehiclesTotal, vehiclesActive, driversTotal, driversAvailable, shipments, delivered] =
    await Promise.all([
      prisma.vehicle.count({ where: { organizationId } }),
      prisma.vehicle.count({ where: { organizationId, status: { not: "AVAILABLE" } } }),
      prisma.driver.count({ where: { organizationId } }),
      prisma.driver.count({ where: { organizationId, status: "AVAILABLE" } }),
      prisma.shipment.findMany({
        where: {
          organizationId,
          createdAt: { gte: range.from, lte: range.to },
        },
        select: { status: true },
      }),
      getDeliveredInRange(range, organizationId),
    ]);

  const activeStatuses = ["PENDING_PICKUP", "PICKED_UP", "IN_TRANSIT", "AT_CHECKPOINT"];
  const byStatus = shipments.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  const deliveredStats = deliveryStats(delivered);

  return {
    range,
    vehicles: { total: vehiclesTotal, active: vehiclesActive },
    drivers: { total: driversTotal, available: driversAvailable },
    shipments: {
      created: shipments.length,
      active: activeStatuses.reduce((acc, s) => acc + (byStatus[s] ?? 0), 0),
      inTransit: (byStatus["IN_TRANSIT"] ?? 0) + (byStatus["AT_CHECKPOINT"] ?? 0),
      delivered: byStatus["DELIVERED"] ?? 0,
      cancelled: byStatus["CANCELLED"] ?? 0,
    },
    delivery: {
      onTimePct: deliveredStats.onTimePct,
      delivered: deliveredStats.delivered,
      late: deliveredStats.late,
      avgDelayMinutes: deliveredStats.avgDelayMinutes,
    },
  };
}
