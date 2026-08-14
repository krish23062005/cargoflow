import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma/client";
import { createTRPCRouter, requirePermission, auditedProcedure } from "@/trpc/init";
import {
  createRouteSchema,
  updateRouteSchema,
  listRoutesSchema,
  routeIdSchema,
  calculateRouteSchema,
  linkRouteSchema,
} from "@/lib/validators/route";
import { calculateRoute } from "@/server/route";

const waypointsToJson = (waypoints: unknown) => waypoints as Prisma.InputJsonValue;
const geometryToJson = (geometry: unknown) =>
  (geometry === null || geometry === undefined ? Prisma.JsonNull : geometry) as
    | Prisma.InputJsonValue
    | typeof Prisma.JsonNull;

/**
 * Route planning — reusable paths saved as templates and linked to shipments.
 * Viewing is available to any role with `route.view` (owner, admin, dispatcher,
 * viewer). Creating / editing / deleting / linking requires `route.manage`.
 * All writes are audited.
 */
export const routeRouter = createTRPCRouter({
  /**
   * Paginated route list with search.
   */
  list: requirePermission("route.view")
    .input(listRoutesSchema)
    .query(async ({ ctx, input }) => {
      const page = Math.max(1, input.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
      const skip = (page - 1) * pageSize;

      const where: Prisma.RouteWhereInput = {
        organizationId: ctx.organizationId,
        ...(input.search
          ? {
              OR: [
                { name: { contains: input.search, mode: "insensitive" } },
                { notes: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.route.findMany({
          where,
          include: {
            shipment: { select: { id: true, trackingNumber: true, customerName: true } },
          },
          orderBy: [{ createdAt: "desc" }],
          skip,
          take: pageSize,
        }),
        ctx.prisma.route.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }),

  /**
   * Single route by id (org-scoped) with its linked shipment.
   */
  get: requirePermission("route.view")
    .input(routeIdSchema)
    .query(async ({ ctx, input }) => {
      const route = await ctx.prisma.route.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        include: {
          shipment: { select: { id: true, trackingNumber: true, customerName: true, status: true } },
        },
      });
      if (!route) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Route not found" });
      }
      return route;
    }),

  /**
   * Preview route calculation (distance / duration / geometry) for a set of
   * waypoints without persisting anything. Read-only.
   */
  calculate: requirePermission("route.view")
    .input(calculateRouteSchema)
    .query(async ({ input }) => calculateRoute(input.waypoints)),

  /**
   * Create a route template. Audited.
   */
  create: auditedProcedure({
    permission: "route.manage",
    resource: "route",
    action: "CREATE",
    resourceId: (_input, result) =>
      (result as { id?: string } | null | undefined)?.id ?? null,
    metadata: (input) => {
      const r = input as { name?: string; totalDistanceKm?: number | null };
      return {
        name: r.name ?? "",
        totalDistanceKm: r.totalDistanceKm ?? null,
      };
    },
  })
    .input(createRouteSchema)
    .mutation(async ({ ctx, input }) => {
      const { waypoints, geometry, ...rest } = input;
      return ctx.prisma.route.create({
        data: {
          organizationId: ctx.organizationId,
          ...rest,
          waypoints: waypointsToJson(waypoints),
          geometry: geometryToJson(geometry),
        },
      });
    }),

  /**
   * Update route metadata, waypoints or calculated stats. Route id is
   * immutable. Audited.
   */
  update: auditedProcedure({
    permission: "route.manage",
    resource: "route",
    action: "UPDATE",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
  })
    .input(updateRouteSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, waypoints, geometry, ...rest } = input;
      const existing = await ctx.prisma.route.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Route not found" });
      }
      return ctx.prisma.route.update({
        where: { id },
        data: {
          ...rest,
          ...(waypoints !== undefined ? { waypoints: waypointsToJson(waypoints) } : {}),
          ...(geometry !== undefined ? { geometry: geometryToJson(geometry) } : {}),
        },
      });
    }),

  /**
   * Delete a route template. A linked shipment keeps its route reference but
   * the FK is nulled (onDelete: SetNull). Audited.
   */
  remove: auditedProcedure({
    permission: "route.manage",
    resource: "route",
    action: "DELETE",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
  })
    .input(routeIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.route.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Route not found" });
      }
      await ctx.prisma.route.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /**
   * Link (or unlink with null) a route to a shipment. A shipment can only be
   * linked to one route and vice versa. Keeps both `Route.shipmentId` and
   * `Shipment.routeId` in sync. Audited.
   */
  linkShipment: auditedProcedure({
    permission: "route.manage",
    resource: "route",
    action: "LINKED_TO_SHIPMENT",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
    metadata: (input) => {
      const l = input as { shipmentId?: string | null };
      return { shipmentId: l.shipmentId ?? null };
    },
  })
    .input(linkRouteSchema)
    .mutation(async ({ ctx, input }) => {
      const route = await ctx.prisma.route.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      if (!route) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Route not found" });
      }

      if (input.shipmentId) {
        const shipment = await ctx.prisma.shipment.findFirst({
          select: { id: true, routeId: true },
          where: { id: input.shipmentId, organizationId: ctx.organizationId },
        });
        if (!shipment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Shipment not found" });
        }
        if (shipment.routeId && shipment.routeId !== input.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That shipment already has a different route linked",
          });
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        // Unlink the shipment from any other route it currently points to.
        if (input.shipmentId) {
          await tx.shipment.updateMany({
            where: { routeId: input.id, NOT: { id: input.shipmentId } },
            data: { routeId: null },
          });
        }

        const updated = await tx.route.update({
          where: { id: route.id },
          data: { shipmentId: input.shipmentId },
        });

        if (input.shipmentId) {
          await tx.shipment.update({
            where: { id: input.shipmentId },
            data: { routeId: route.id },
          });
        }

        return updated;
      });
    }),
});