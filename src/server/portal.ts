import type { Waypoint } from "@/lib/validators/route";
import { prisma } from "@/lib/db";
import { cacheGetOrSet } from "@/lib/cache";
import { getShipmentEta, type EtaLive } from "@/server/eta";

/**
 * Portal responses are cached for a short window (8s) so a shared tracking
 * link — hit by many phones/QR scans — doesn't hammer the database on every
 * poll. Positions refresh at most every ~10s from the driver app, so 8s is
 * well within the freshness the page already promises.
 */
const PORTAL_CACHE_TTL_SECONDS = 8;

/**
 * Public tracking portal — read-only, no authentication.
 *
 * A customer holding their tracking number can view shipment status, the
 * origin/destination, the latest position on a map, a live ETA and the event
 * trail — all branded with the shipper's organization. This module owns the
 * aggregation; HTTP routing + rate limiting live in the portal API route and
 * the `/portal/[trackingNumber]` page.
 */

export type PortalOrganization = {
  name: string;
  logo: string | null;
  slug: string;
};

export type PortalShipment = {
  id: string;
  trackingNumber: string;
  status: string;
  customerName: string;
  cargoType: string;
  cargoDescription: string | null;
  originAddress: string;
  originCity: string | null;
  originLat: number | null;
  originLng: number | null;
  destinationAddress: string;
  destinationCity: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  requestedPickupAt: Date | null;
  estimatedDeliverAt: Date | null;
  actualDeliveredAt: Date | null;
  createdAt: Date;
};

export type PortalEvent = {
  id: string;
  eventType: string;
  description: string | null;
  location: string | null;
  createdAt: Date;
};

export type PortalPosition = {
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  headingDeg: number | null;
  recordedAt: Date | null;
  source: string | null;
};

export type PortalVehicle = {
  plateNumber: string;
  make: string;
  model: string;
  status: string;
} | null;

export type PortalDriver = { name: string } | null;

export type PortalData = {
  organization: PortalOrganization;
  shipment: PortalShipment;
  events: PortalEvent[];
  position: PortalPosition;
  vehicle: PortalVehicle;
  driver: PortalDriver;
  route: {
    name: string;
    waypoints: Waypoint[];
    geometry: [number, number][] | null;
  } | null;
  eta: EtaLive | null;
};

/** Aggregated public view of one shipment by its tracking number. */
export async function getPortalData(trackingNumber: string): Promise<PortalData | null> {
  const key = `portal:${trackingNumber.toUpperCase()}`;
  const cached = await cacheGetOrSet<PortalData | null>(
    key,
    PORTAL_CACHE_TTL_SECONDS,
    () => loadPortalData(trackingNumber),
  );
  return cached;
}

async function loadPortalData(trackingNumber: string): Promise<PortalData | null> {
  const shipment = await prisma.shipment.findFirst({
    where: {
      trackingNumber: { equals: trackingNumber.toUpperCase(), mode: "insensitive" },
    },
    include: {
      organization: {
        select: { id: true, name: true, logo: true, slug: true },
      },
      assignment: {
        select: {
          vehicle: { select: { id: true, plateNumber: true, make: true, model: true, status: true } },
          driver: { select: { name: true } },
        },
      },
      route: { select: { name: true, waypoints: true, geometry: true } },
      events: {
        select: {
          id: true,
          eventType: true,
          description: true,
          location: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!shipment) return null;

  const { organization, assignment, route, events, ...rest } = shipment;

  // Latest recorded position for the delivering vehicle (if any).
  let position: PortalPosition = {
    lat: null,
    lng: null,
    speedKmh: null,
    headingDeg: null,
    recordedAt: null,
    source: null,
  };
  const vehicleId = assignment?.vehicle?.id;
  if (vehicleId) {
    const latest = await prisma.trackingPoint.findFirst({
      where: { organizationId: organization.id, vehicleId },
      orderBy: { recordedAt: "desc" },
      select: {
        lat: true,
        lng: true,
        speedKmh: true,
        headingDeg: true,
        recordedAt: true,
        source: true,
      },
    });
    if (latest) position = latest;
  }

  // Live ETA, reusing the same estimator as the dashboard.
  let eta: EtaLive | null = null;
  try {
    const { eta: shipmentEta } = await getShipmentEta(prisma, organization.id, shipment.id);
    eta = shipmentEta;
  } catch {
    eta = null;
  }

  const waypointsRaw = Array.isArray(route?.waypoints) ? route.waypoints : [];
  const waypoints = waypointsRaw as Waypoint[];
  const geometryRaw = Array.isArray(route?.geometry) ? route.geometry : null;

  return {
    organization,
    shipment: {
      id: rest.id,
      trackingNumber: rest.trackingNumber,
      status: rest.status,
      customerName: rest.customerName,
      cargoType: rest.cargoType,
      cargoDescription: rest.cargoDescription,
      originAddress: rest.originAddress,
      originCity: rest.originCity,
      originLat: rest.originLat,
      originLng: rest.originLng,
      destinationAddress: rest.destinationAddress,
      destinationCity: rest.destinationCity,
      destinationLat: rest.destinationLat,
      destinationLng: rest.destinationLng,
      requestedPickupAt: rest.requestedPickupAt,
      estimatedDeliverAt: rest.estimatedDeliverAt,
      actualDeliveredAt: rest.actualDeliveredAt,
      createdAt: rest.createdAt,
    },
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      description: e.description,
      location: e.location,
      createdAt: e.createdAt,
    })),
    position,
    vehicle: assignment?.vehicle
      ? {
          plateNumber: assignment.vehicle.plateNumber,
          make: assignment.vehicle.make,
          model: assignment.vehicle.model,
          status: assignment.vehicle.status,
        }
      : null,
    driver: assignment?.driver ? { name: assignment.driver.name } : null,
    route: route
      ? { name: route.name, waypoints, geometry: geometryRaw as [number, number][] | null }
      : null,
    eta,
  };
}

/** Absolute portal URL for a tracking number (share link / QR target). */
export function getPortalUrl(trackingNumber: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`;
  return `${base.replace(/\/$/, "")}/portal/${encodeURIComponent(
    trackingNumber.toUpperCase(),
  )}`;
}

/**
 * Send the tracking link to a customer (email/SMS placeholder).
 *
 * The full message stays on the public portal page (no auth needed), so the
 * payload here is just the URL. Real delivery (Resend email / Africa's Talking
 * SMS) is not configured yet — mirrors the notification service's placeholder
 * pattern so the plumbing is visible and switchable later.
 */
export async function sendTrackingLinkPlaceholder(args: {
  trackingNumber: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
}): Promise<void> {
  const url = getPortalUrl(args.trackingNumber);
  try {
    if (args.customerEmail) {
      console.log(
        `[tracking-link:email] → ${args.customerEmail} · ${args.trackingNumber} · ${url}`,
      );
    }
    if (args.customerPhone) {
      console.log(
        `[tracking-link:sms] → ${args.customerPhone} · ${args.trackingNumber} · ${url}`,
      );
    }
  } catch {
    // Never let delivery break shipment creation.
  }
}