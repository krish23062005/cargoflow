import { prisma } from "@/lib/db";
import { createPodSchema, getPodForShipmentSchema, type CreatePodInput } from "@/lib/validators/pod";
import { notifyByPermission } from "@/server/notification";
import { generatePodQrDataUrl, podQrPayload } from "@/lib/utils/qr";

export type PodPhotoStored = { dataUrl: string; contentType: string };

/**
 * Create proof of delivery for a shipment. Runs in a transaction: stores the
 * POD, appends a `POD_CAPTURED` timeline event and notifies every member with
 * `shipment.view`. Email confirmation is a logged placeholder (Resend deferred).
 */
export async function createProofOfDelivery(args: {
  organizationId: string;
  shipmentId: string;
  actorName?: string | null;
  input: CreatePodInput;
}) {
  const parsed = createPodSchema.parse(args.input);
  if (parsed.shipmentId !== args.shipmentId) {
    throw new Error("SHIPMENT_MISMATCH");
  }

  const shipment = await prisma.shipment.findFirst({
    where: { id: args.shipmentId, organizationId: args.organizationId },
    include: { assignment: { select: { vehicle: { select: { plateNumber: true } } } } },
  });
  if (!shipment) throw new Error("NOT_FOUND");

  const proof = await prisma.$transaction(async (tx) => {
    const created = await tx.proofOfDelivery.create({
      data: {
        organizationId: args.organizationId,
        shipmentId: shipment.id,
        photos: parsed.photos as PodPhotoStored[],
        signature: parsed.signature ?? null,
        recipientName: parsed.recipientName,
        recipientPhone: parsed.recipientPhone ?? null,
        notes: parsed.notes ?? null,
        locationLat: parsed.locationLat ?? null,
        locationLng: parsed.locationLng ?? null,
        capturedByName: args.actorName ?? null,
      },
    });

    await tx.shipmentEvent.create({
      data: {
        organizationId: args.organizationId,
        shipmentId: shipment.id,
        eventType: "POD_CAPTURED",
        description: `Proof of delivery captured · recipient ${parsed.recipientName}${
          args.actorName ? ` · by driver ${args.actorName}` : ""
        }`,
        latitude: parsed.locationLat ?? null,
        longitude: parsed.locationLng ?? null,
      },
    });

    await notifyByPermission(tx, {
      organizationId: args.organizationId,
      permission: "shipment.view",
      type: "SHIPMENT_STATUS_CHANGE",
      title: `Proof of delivery captured for ${shipment.trackingNumber}`,
      body: `Recipient ${parsed.recipientName}${
        assortmentDescription(parsed) ? ` · ${assortmentDescription(parsed)}` : ""
      }`,
      link: `/shipments/${shipment.id}`,
    });

    void sendPodConfirmationPlaceholder(shipment, parsed, args.actorName);
    return created;
  });

  return proof;
}

function assortmentDescription(input: CreatePodInput): string {
  const parts: string[] = [];
  if ((input.photos ?? []).length > 0) parts.push(`${input.photos.length} photo(s)`);
  if (input.signature) parts.push("signed");
  return parts.join(" + ");
}

/** Email confirmation placeholder — logs until Resend is configured. */
async function sendPodConfirmationPlaceholder(
  shipment: { trackingNumber: string; customerEmail?: string | null; customerName: string },
  input: CreatePodInput,
  actorName?: string | null,
) {
  const to = shipment.customerEmail ?? "customer@email";
  console.log(
    `[pod-confirmation:email] to=${to} shipment=${shipment.trackingNumber} recipient=${input.recipientName} by=${actorName ?? "?"}`,
  );
}

/** Latest proof of delivery for a shipment (member dashboard view). */
export async function getProofByShipment(args: {
  organizationId: string;
  shipmentId: string;
}) {
  getPodForShipmentSchema.parse({ shipmentId: args.shipmentId });
  return prisma.proofOfDelivery.findFirst({
    where: { organizationId: args.organizationId, shipmentId: args.shipmentId },
    orderBy: { capturedAt: "desc" },
  });
}

/** True when the driver can capture POD for this shipment (assigned to them). */
export async function assertDriverCanPod(args: {
  driverId: string;
  organizationId: string;
  shipmentId: string;
}): Promise<boolean> {
  const assignment = await prisma.vehicleAssignment.findFirst({
    where: {
      organizationId: args.organizationId,
      driverId: args.driverId,
      status: "ACTIVE",
      shipments: { some: { id: args.shipmentId } },
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

/** Delivery QR payload + PNG for a shipment (used by dashboard and driver). */
export async function getShipmentQr(args: {
  organizationId: string;
  shipmentId: string;
}): Promise<{ trackingNumber: string; payload: string; dataUrl: string } | null> {
  const shipment = await prisma.shipment.findFirst({
    where: { id: args.shipmentId, organizationId: args.organizationId },
    select: { trackingNumber: true },
  });
  if (!shipment) return null;
  const payload = podQrPayload(shipment.trackingNumber);
  const dataUrl = await generatePodQrDataUrl(payload);
  return { trackingNumber: shipment.trackingNumber, payload, dataUrl };
}