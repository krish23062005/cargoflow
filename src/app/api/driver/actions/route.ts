import { getDriverContext, advanceShipmentStatus, logDriverEvent } from "@/server/driver";

export const runtime = "nodejs";

const DRIVER_ACTIONS = ["start_trip", "departed", "arrived", "issue"] as const;
type DriverAction = (typeof DRIVER_ACTIONS)[number];

/** Map a driver quick-action to its forward status transition. */
const ACTION_STATUS: Partial<Record<DriverAction, string>> = {
  start_trip: "PICKED_UP",
  departed: "IN_TRANSIT",
  arrived: "DELIVERED",
};

/**
 * Driver quick actions. Operates on the shipment in the driver's current
 * active assignment:
 * - `start_trip` → PICKED_UP, `departed` → IN_TRANSIT, `arrived` → DELIVERED
 * - `issue` → logs a driver NOTE event (no status change)
 */
export async function POST(req: Request) {
  const context = await getDriverContext();
  if (!context) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!context.shipment) {
    return Response.json({ error: "No active shipment" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const action = input.action as DriverAction;
  if (!DRIVER_ACTIONS.includes(action)) {
    return Response.json({ error: `Action must be one of ${DRIVER_ACTIONS.join(", ")}` }, { status: 400 });
  }

  const shipmentId = context.shipment.id;

  if (action === "issue") {
    const description =
      typeof input.description === "string" && input.description.trim().length > 0
        ? input.description.trim()
        : "Driver reported an issue";
    await logDriverEvent({
      shipmentId,
      eventType: "NOTE",
      description,
      actorName: context.driver.name,
      organizationId: context.organizationId,
      location: typeof input.location === "string" ? input.location : null,
    });
    return Response.json({ ok: true });
  }

  const toStatus = ACTION_STATUS[action]!;
  const result = await advanceShipmentStatus({
    shipmentId,
    toStatus,
    actorName: context.driver.name,
    organizationId: context.organizationId,
  });
  if (!result.ok || !("shipment" in result)) {
    return Response.json(
      { error: result.code === "NOT_FOUND" ? "Shipment not found" : "Invalid status transition" },
      { status: result.code === "NOT_FOUND" ? 404 : 409 },
    );
  }
  return Response.json({ ok: true, status: result.shipment.status });
}