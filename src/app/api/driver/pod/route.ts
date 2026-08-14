import { getDriverContext } from "@/server/driver";
import {
  assertDriverCanPod,
  createProofOfDelivery,
  getProofByShipment,
  getShipmentQr,
} from "@/server/pod";
import type { CreatePodInput } from "@/lib/validators/pod";

export const runtime = "nodejs";

/**
 * Driver proof-of-delivery endpoint.
 * - GET: latest POD + delivery QR for the driver's current shipment.
 * - POST: capture a POD (photos, signature, recipient) for it.
 * Only the shipment in the driver's ACTIVE assignment may be captured.
 */
export async function GET() {
  const context = await getDriverContext();
  if (!context) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const shipmentId = context.shipment?.id;
  if (!shipmentId) return Response.json({ error: "No active shipment" }, { status: 400 });

  const [proof, qr] = await Promise.all([
    getProofByShipment({ organizationId: context.organizationId, shipmentId }),
    getShipmentQr({ organizationId: context.organizationId, shipmentId }),
  ]);

  return Response.json({
    shipment: context.shipment,
    proof,
    qr,
  });
}

export async function POST(req: Request) {
  const context = await getDriverContext();
  if (!context) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const shipmentId = typeof input.shipmentId === "string" ? input.shipmentId : null;
  if (!shipmentId) {
    return Response.json({ error: "shipmentId is required" }, { status: 400 });
  }

  const allowed = await assertDriverCanPod({
    driverId: context.driverId,
    organizationId: context.organizationId,
    shipmentId,
  });
  if (!allowed) {
    return Response.json(
      { error: "This shipment is not assigned to you" },
      { status: 403 },
    );
  }

  try {
    const proof = await createProofOfDelivery({
      organizationId: context.organizationId,
      shipmentId,
      actorName: context.driver.name,
      input: input as CreatePodInput,
    });
    return Response.json({ ok: true, proof });
  } catch (e) {
    const message = e instanceof Error ? e.message : "POD failed";
    if (message === "NOT_FOUND") {
      return Response.json({ error: "Shipment not found" }, { status: 404 });
    }
    if (message === "SHIPMENT_MISMATCH") {
      return Response.json({ error: "Shipment mismatch" }, { status: 400 });
    }
    return Response.json({ error: "INVALID" }, { status: 400 });
  }
}