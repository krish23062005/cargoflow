import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, requirePermission } from "@/trpc/init";
import { etaHistorySchema } from "@/lib/validators/eta";
import { getShipmentEta } from "@/server/eta";

/**
 * Live ETA + prediction history for a shipment. Read-only, gated by the same
 * `shipment.view` permission as the shipment detail the card lives on.
 */
export const etaRouter = createTRPCRouter({
  /**
   * Current ETA for a shipment (predicted arrival, remaining km, whether it
   * is running behind the promised delivery time).
   */
  forShipment: requirePermission("shipment.view")
    .input(z.object({ shipmentId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const shipment = await ctx.prisma.shipment.findFirst({
        select: { id: true },
        where: { id: input.shipmentId, organizationId: ctx.organizationId },
      });
      if (!shipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shipment not found" });
      }
      return getShipmentEta(ctx.prisma, ctx.organizationId, shipment.id);
    }),

  /**
   * Recent ETA samples for a shipment — the predicted-vs-actual trail used
   * to judge (and later improve) prediction accuracy.
   */
  history: requirePermission("shipment.view")
    .input(
      etaHistorySchema.extend({
        shipmentId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const shipment = await ctx.prisma.shipment.findFirst({
        select: { id: true },
        where: { id: input.shipmentId, organizationId: ctx.organizationId },
      });
      if (!shipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shipment not found" });
      }
      return ctx.prisma.etaPrediction.findMany({
        where: { organizationId: ctx.organizationId, shipmentId: shipment.id },
        orderBy: [{ predictedAt: "desc" }],
        take: input.limit ?? 20,
      });
    }),
});