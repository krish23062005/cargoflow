import { cookies } from "next/headers";
import type { Waypoint } from "@/lib/validators/route";
import { prisma } from "@/lib/db";
import { hashPin, verifyPin, legacyVerifyPin } from "@/lib/pin";
import { getShipmentEta, type EtaLive } from "@/server/eta";
import { NEXT_SHIPMENT_STATUSES } from "@/lib/constants/shipments";
import { getShipmentStatusLabel } from "@/lib/constants/shipments";
import { notifyByPermission } from "@/server/notification";
import { stampDeliveredAt } from "@/server/eta";

export const DRIVER_SESSION_COOKIE = "cf_driver_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/** Shape of the driver session cookie: `<organizationId>:<driverId>`. */
function encode(organizationId: string, driverId: string): string {
  return Buffer.from(`${organizationId}:${driverId}`).toString("base64url");
}

function decode(token: string): { organizationId: string; driverId: string } | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const idx = raw.indexOf(":");
    if (idx <= 0) return null;
    return { organizationId: raw.slice(0, idx), driverId: raw.slice(idx + 1) };
  } catch {
    return null;
  }
}

/**
 * Driver session cookie — a lightweight, separate auth channel from the
 * member dashboard (drivers are not `User` accounts). Set by the driver login
 * API and read by the `/driver` route group.
 */
export async function getDriverSession() {
  const store = await cookies();
  const token = store.get(DRIVER_SESSION_COOKIE)?.value;
  if (!token) return null;
  return decode(token);
}

export async function setDriverSession(organizationId: string, driverId: string) {
  const store = await cookies();
  store.set(DRIVER_SESSION_COOKIE, encode(organizationId, driverId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearDriverSession() {
  const store = await cookies();
  store.delete(DRIVER_SESSION_COOKIE);
}

export type DriverContext = {
  driverId: string;
  organizationId: string;
  driver: {
    id: string;
    name: string;
    phone: string;
  };
  organization: { name: string; slug: string };
  assignment: {
    id: string;
    vehicleId: string;
    vehicle: { plateNumber: string; make: string; model: string };
  } | null;
  shipment: {
    id: string;
    trackingNumber: string;
    status: string;
    customerName: string;
    cargoType: string;
    cargoDescription: string | null;
    originAddress: string;
    destinationAddress: string;
    requestedPickupAt: Date | null;
    estimatedDeliverAt: Date | null;
    actualDeliveredAt: Date | null;
  } | null;
  route: {
    id: string;
    name: string;
    waypoints: Waypoint[];
    geometry: [number, number][] | null;
  } | null;
  eta: EtaLive | null;
  position: {
    lat: number | null;
    lng: number | null;
    speedKmh: number | null;
    recordedAt: Date | null;
  } | null;
};

/**
 * Full driver context for the mobile app screens. Returns `null` when the
 * session is invalid or the driver no longer belongs to the org.
 */
export async function getDriverContext(): Promise<DriverContext | null> {
  const session = await getDriverSession();
  if (!session) return null;

  const driver = await prisma.driver.findFirst({
    where: { id: session.driverId, organizationId: session.organizationId },
    include: {
      organization: { select: { name: true, slug: true } },
      assignments: {
        where: { status: "ACTIVE" },
        orderBy: { startDate: "desc" },
        take: 1,
        select: {
          id: true,
          vehicleId: true,
          vehicle: { select: { plateNumber: true, make: true, model: true } },
          shipments: {
            select: {
              id: true,
              trackingNumber: true,
              status: true,
              customerName: true,
              cargoType: true,
              cargoDescription: true,
              originAddress: true,
              destinationAddress: true,
              requestedPickupAt: true,
              estimatedDeliverAt: true,
              actualDeliveredAt: true,
              route: { select: { id: true, name: true, waypoints: true, geometry: true } },
            },
          },
        },
      },
    },
  });
  if (!driver) return null;

  const assignment = driver.assignments[0] ?? null;
  const shipment = assignment ? assignment.shipments[0] ?? null : null;

  // Latest position for the assigned vehicle.
  let position: DriverContext["position"] = null;
  if (assignment) {
    const latest = await prisma.trackingPoint.findFirst({
      where: { organizationId: session.organizationId, vehicleId: assignment.vehicleId },
      orderBy: { recordedAt: "desc" },
      select: { lat: true, lng: true, speedKmh: true, recordedAt: true },
    });
    position = latest ?? null;
  }

  // Live ETA for the shipment, reusing the dashboard estimator.
  let eta: EtaLive | null = null;
  if (shipment) {
    try {
      const { eta: shipmentEta } = await getShipmentEta(
        prisma,
        session.organizationId,
        shipment.id,
      );
      eta = shipmentEta;
    } catch {
      eta = null;
    }
  }

  const route = shipment?.route
    ? {
        id: shipment.route.id,
        name: shipment.route.name,
        waypoints: Array.isArray(shipment.route.waypoints)
          ? (shipment.route.waypoints as Waypoint[])
          : [],
        geometry: Array.isArray(shipment.route.geometry)
          ? (shipment.route.geometry as [number, number][])
          : null,
      }
    : null;

  return {
    driverId: driver.id,
    organizationId: session.organizationId,
    driver: { id: driver.id, name: driver.name, phone: driver.phone },
    organization: driver.organization,
    assignment,
    shipment,
    route,
    eta,
    position,
  };
}

/** Verify phone + PIN against a driver, returning its org/driver identity. */
export async function verifyDriverLogin(args: {
  phone: string;
  pin: string;
}): Promise<{ organizationId: string; driverId: string } | null> {
  const phone = args.phone.trim().replace(/^\+/, "");
  const drivers = await prisma.driver.findMany({
    where: {
      OR: [{ phone: args.phone.trim() }, { phone: `+${phone}` }, { phone }],
    },
    select: { id: true, organizationId: true, pin: true },
  });
  for (const driver of drivers) {
    if (verifyPin(args.pin, driver.pin) || legacyVerifyPin(args.pin, driver.pin)) {
      return { organizationId: driver.organizationId, driverId: driver.id };
    }
  }
  return null;
}

/** Ensure a driver has a PIN (upserted hashed); used by admin-set flows. */
export async function ensureDriverPin(driverId: string, organizationId: string, pin: string) {
  const hashed = hashPin(pin);
  if (!hashed) return false;
  await prisma.driver.update({
    where: { id: driverId, organizationId },
    data: { pin: hashed },
  });
  return true;
}

/**
 * Advance a shipment's status from the driver app. Enforces the same
 * forward-only transitions as the dashboard, logs an event, stamps delivery
 * ETA predictions and notifies team members with `shipment.view`.
 */
export async function advanceShipmentStatus(args: {
  shipmentId: string;
  toStatus: string;
  actorName: string;
  organizationId: string;
}) {
  const shipment = await prisma.shipment.findFirst({
    where: { id: args.shipmentId, organizationId: args.organizationId },
  });
  if (!shipment) return { ok: false, code: "NOT_FOUND" as const };
  if (shipment.status === args.toStatus) {
    return { ok: false, code: "CONFLICT" as const };
  }
  const allowed = NEXT_SHIPMENT_STATUSES[shipment.status] ?? [];
  if (!allowed.includes(args.toStatus as (typeof NEXT_SHIPMENT_STATUSES)[string][number])) {
    return { ok: false, code: "CONFLICT" as const };
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: args.toStatus,
        ...(args.toStatus === "DELIVERED" ? { actualDeliveredAt: new Date() } : {}),
      },
    });

    await tx.shipmentEvent.create({
      data: {
        organizationId: args.organizationId,
        shipmentId: shipment.id,
        eventType: "STATUS_CHANGED",
        description: `Status changed from ${shipment.status} to ${args.toStatus} · by driver ${args.actorName}`,
      },
    });

    if (args.toStatus === "DELIVERED") {
      await stampDeliveredAt(tx, args.organizationId, shipment.id, updated.actualDeliveredAt ?? new Date());
    }

    await notifyByPermission(tx, {
      organizationId: args.organizationId,
      type: "SHIPMENT_STATUS_CHANGE",
      title: `Shipment ${updated.trackingNumber} is now ${getShipmentStatusLabel(args.toStatus)}`,
      body: `Status changed from ${getShipmentStatusLabel(shipment.status)} to ${getShipmentStatusLabel(args.toStatus)} · by driver ${args.actorName}`,
      link: `/shipments/${shipment.id}`,
    });

    return { ok: true as const, shipment: updated };
  });
}

/** Log a manual event (checkpoint reached / issue report) from the driver app. */
export async function logDriverEvent(args: {
  shipmentId: string;
  eventType: string;
  description: string;
  actorName: string;
  organizationId: string;
  location?: string | null;
}) {
  const shipment = await prisma.shipment.findFirst({
    where: { id: args.shipmentId, organizationId: args.organizationId },
  });
  if (!shipment) return { ok: false, code: "NOT_FOUND" as const };

  await prisma.shipmentEvent.create({
    data: {
      organizationId: args.organizationId,
      shipmentId: shipment.id,
      eventType: args.eventType,
      description: `${args.description} · by driver ${args.actorName}`,
      location: args.location ?? null,
    },
  });
  return { ok: true as const };
}

export type DriverTrip = {
  assignmentId: string;
  assignmentStatus: string;
  startDate: Date;
  endDate: Date | null;
  vehicle: { plateNumber: string; make: string; model: string } | null;
  shipment: {
    id: string;
    trackingNumber: string;
    status: string;
    customerName: string;
    cargoType: string;
    originAddress: string;
    destinationAddress: string;
    requestedPickupAt: Date | null;
    estimatedDeliverAt: Date | null;
    actualDeliveredAt: Date | null;
    createdAt: Date;
    routeName: string | null;
  } | null;
};

/**
 * Trip history for the logged-in driver: every assignment (current and past),
 * newest first, with its vehicle and the shipment it carried.
 */
export async function getDriverTrips(): Promise<DriverTrip[] | null> {
  const session = await getDriverSession();
  if (!session) return null;

  const assignments = await prisma.vehicleAssignment.findMany({
    where: { organizationId: session.organizationId, driverId: session.driverId },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      vehicle: { select: { plateNumber: true, make: true, model: true } },
      shipments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          trackingNumber: true,
          status: true,
          customerName: true,
          cargoType: true,
          originAddress: true,
          destinationAddress: true,
          requestedPickupAt: true,
          estimatedDeliverAt: true,
          actualDeliveredAt: true,
          createdAt: true,
          route: { select: { name: true } },
        },
      },
    },
  });

  return assignments.map((a) => {
    const s = a.shipments[0] ?? null;
    return {
      assignmentId: a.id,
      assignmentStatus: a.status,
      startDate: a.startDate,
      endDate: a.endDate,
      vehicle: a.vehicle,
      shipment: s
        ? {
            id: s.id,
            trackingNumber: s.trackingNumber,
            status: s.status,
            customerName: s.customerName,
            cargoType: s.cargoType,
            originAddress: s.originAddress,
            destinationAddress: s.destinationAddress,
            requestedPickupAt: s.requestedPickupAt,
            estimatedDeliverAt: s.estimatedDeliverAt,
            actualDeliveredAt: s.actualDeliveredAt,
            createdAt: s.createdAt,
            routeName: s.route?.name ?? null,
          }
        : null,
    };
  });
}