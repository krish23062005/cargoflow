import { TRPCError } from "@trpc/server";
import { createTRPCRouter, requirePermission } from "@/trpc/init";
import { getPodForShipmentSchema } from "@/lib/validators/pod";
import { getProofByShipment, getShipmentQr } from "@/server/pod";

/**
 * Proof-of-delivery viewer for the dashboard. PODs themselves are captured by
 * the driver PWA (`/api/driver/pod`); dispatchers/managers read them here.
 */
export const podRouter = createTRPCRouter({
  /**
   * Latest proof of delivery for a shipment (photos, signature, recipient,
   * location + capture timestamp).
   */
  getForShipment: requirePermission("shipment.view")
    .input(getPodForShipmentSchema)
    .query(async ({ ctx, input }) => {
      const proof = await getProofByShipment({
        organizationId: ctx.organizationId,
        shipmentId: input.shipmentId,
      });
      if (!proof) return null;
      return {
        ...proof,
        photos: Array.isArray(proof.photos) ? (proof.photos as { dataUrl: string; contentType: string }[]) : [],
      };
    }),

  /**
   * Delivery QR for a shipment, printed on the cargo label / delivery slip.
   * Encodes the tracking number + verification checksum.
   */
  qr: requirePermission("shipment.view")
    .input(getPodForShipmentSchema)
    .query(async ({ ctx, input }) => {
      const qr = await getShipmentQr({
        organizationId: ctx.organizationId,
        shipmentId: input.shipmentId,
      });
      if (!qr) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shipment not found" });
      }
      return qr;
    }),
});