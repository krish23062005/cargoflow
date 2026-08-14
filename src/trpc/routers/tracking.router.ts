import { createTRPCRouter, requirePermission } from "@/trpc/init";
import {
  liveTrackingSchema,
  trackingHistorySchema,
} from "@/lib/validators/tracking";
import { getOrgLive } from "@/server/tracking";

/**
 * Tracking reads: latest positions for the org's fleet plus per-vehicle track
 * history. Read-only — ingestion happens through the driver PWA (POST
 * /api/tracking/ingest) and live updates stream over SSE.
 */
export const trackingRouter = createTRPCRouter({
  /**
   * Latest position (and driver / status context) for every vehicle in the
   * active organization.
   */
  live: requirePermission("tracking.view")
    .input(liveTrackingSchema)
    .query(async ({ ctx, input }) => {
      const vehicles = await getOrgLive(ctx.prisma, ctx.organizationId);
      if (input.includeInactive) {
        return vehicles;
      }
      // Keep only vehicles that reported recently (or are reachable).
      return vehicles.filter(
        (v) => v.recordedAt && Date.now() - v.recordedAt.getTime() < 10 * 60 * 1000,
      );
    }),

  /**
   * Track history (recent path) for one vehicle.
   */
  history: requirePermission("tracking.view")
    .input(trackingHistorySchema)
    .query(async ({ ctx, input }) => {
      const { vehicleId, from, to, limit } = input;

      const vehicle = await ctx.prisma.vehicle.findFirst({
        select: { id: true },
        where: { id: vehicleId, organizationId: ctx.organizationId },
      });
      if (!vehicle) {
        return { vehicleId, points: [] };
      }

      const points = await ctx.prisma.trackingPoint.findMany({
        where: {
          vehicleId,
          organizationId: ctx.organizationId,
          ...(from ? { recordedAt: { gte: from } } : {}),
          ...(to ? { recordedAt: { lte: to } } : {}),
        },
        orderBy: { recordedAt: "desc" },
        take: limit ?? 200,
      });

      return { vehicleId, points };
    }),
});