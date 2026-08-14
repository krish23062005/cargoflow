import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { batchTrackingSchema } from "@/lib/validators/tracking";
import { ingestPoints } from "@/server/tracking";
import { recomputeEtasForVehicles } from "@/server/eta";
import { getDriverSession } from "@/server/driver";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tracking ingestion endpoint (driver PWA → server).
 *
 * Accepts a batch of location updates for vehicles the requesting (authenticated)
 * member belongs to. Points for vehicles outside the org are skipped. Stores
 * readings and broadcasts the refreshed snapshot to every open SSE dashboard.
 *
 * Request body: `{ "points": [ {vehicleId, lat, lng, speedKmh?, headingDeg?,
 * accuracyM?, source?, recordedAt?}, ... ] }` (max 100 points).
 */
export async function POST(req: Request) {
  if (req.headers.get("content-type")?.toLowerCase() !== "application/json") {
    return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
  }

  // Auth: either a dashboard member session or a driver PWA session.
  let organizationId: string | null = null;
  let allowedVehicleIds: string[] | null = null;

  const memberSession = await auth.api.getSession({ headers: await headers() });
  if (memberSession?.user) {
    const activeOrg = memberSession.session.activeOrganizationId;
    if (!activeOrg) {
      return Response.json({ error: "No active organization" }, { status: 400 });
    }
    organizationId = activeOrg;
    const member = await prisma.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: memberSession.user.id,
        },
      },
      select: { id: true },
    });
    if (!member) {
      return Response.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  } else {
    const driverSession = await getDriverSession();
    if (!driverSession) {
      return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    organizationId = driverSession.organizationId;
    // A driver can only report positions for a vehicle in their active assignment.
    const assignment = await prisma.vehicleAssignment.findFirst({
      where: { organizationId, driverId: driverSession.driverId, status: "ACTIVE" },
      select: { vehicleId: true },
    });
    if (!assignment) {
      return Response.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    allowedVehicleIds = [assignment.vehicleId];
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = batchTrackingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid tracking payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Drivers may only report for their assigned vehicle; anything else is
  // dropped so the PWA can't spoof another vehicle's position.
  const activePoints = () =>
    allowedVehicleIds
      ? parsed.data.points.filter((p) => allowedVehicleIds!.includes(p.vehicleId))
      : parsed.data.points;

  const result = await ingestPoints({
    prisma,
    organizationId,
    points: activePoints(),
  });

  // Recalculate live ETAs for every vehicle that just reported, so dashboards
  // get an up-to-date `eta` (and `eta_delayed`) stream immediately.
  const trackedVehicleIds = Array.from(
    new Set(activePoints().map((p) => p.vehicleId)),
  );
  const etaByVehicle = await recomputeEtasForVehicles(
    prisma,
    organizationId,
    trackedVehicleIds,
  );

  return Response.json({
    ...result,
    etas: Array.from(etaByVehicle.values()),
  });
}