import { TRPCError } from "@trpc/server";
import type { Prisma } from "@/generated/prisma/client";
import { createTRPCRouter, requirePermission, auditedProcedure } from "@/trpc/init";
import {
  createShipmentSchema,
  updateShipmentSchema,
  updateShipmentStatusSchema,
  assignShipmentSchema,
  addShipmentEventSchema,
  listShipmentsSchema,
  shipmentIdSchema,
} from "@/lib/validators/shipment";
import { generateTrackingNumber } from "@/lib/utils/tracking-number";
import { isActiveShipmentStatus, NEXT_SHIPMENT_STATUSES } from "@/lib/constants/shipments";
import { stampDeliveredAt } from "@/server/eta";
import { sendTrackingLinkPlaceholder } from "@/server/portal";
import { notifyByPermission } from "@/server/notification";
import { getShipmentStatusLabel } from "@/lib/constants/shipments";

/**
 * Shipment management — the core business object. Viewing is available to
 * any role with `shipment.view` (owner, admin, dispatcher, viewer, driver).
 * Creating requires `shipment.create`; status updates require
 * `shipment.update_status` (drivers can advance their own shipment's status).
 * All writes are audited.
 */
export const shipmentRouter = createTRPCRouter({
  /**
   * Paginated shipment list with search + status filter.
   */
  list: requirePermission("shipment.view")
    .input(listShipmentsSchema)
    .query(async ({ ctx, input }) => {
      const page = Math.max(1, input.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
      const skip = (page - 1) * pageSize;

      const where: Prisma.ShipmentWhereInput = {
        organizationId: ctx.organizationId,
        ...(input.search
          ? {
              OR: [
                { trackingNumber: { contains: input.search, mode: "insensitive" } },
                { customerName: { contains: input.search, mode: "insensitive" } },
                { originAddress: { contains: input.search, mode: "insensitive" } },
                { destinationAddress: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(input.status ? { status: input.status } : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.shipment.findMany({
          where,
          include: {
            assignment: {
              select: {
                id: true,
                vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
                driver: { select: { id: true, name: true, phone: true } },
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          skip,
          take: pageSize,
        }),
        ctx.prisma.shipment.count({ where }),
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
   * Shipment summary counts for dashboards and KPIs.
   */
  summary: requirePermission("shipment.view").query(async ({ ctx }) => {
    const byStatus = await ctx.prisma.shipment.groupBy({
      by: ["status"],
      where: { organizationId: ctx.organizationId },
      _count: { _all: true },
    });
    const total = byStatus.reduce((sum, g) => sum + g._count._all, 0);
    const statusCounts = Object.fromEntries(byStatus.map((g) => [g.status, g._count._all]));
    return {
      total,
      active: byStatus.reduce(
        (sum, g) => sum + (isActiveShipmentStatus(g.status) ? g._count._all : 0),
        0,
      ),
      pendingPickup: statusCounts["PENDING_PICKUP"] ?? 0,
      inTransit: statusCounts["IN_TRANSIT"] ?? 0,
      delivered: statusCounts["DELIVERED"] ?? 0,
      cancelled: statusCounts["CANCELLED"] ?? 0,
    };
  }),

  /**
   * Single shipment by id (org-scoped) with its full event trail.
   */
  get: requirePermission("shipment.view")
    .input(shipmentIdSchema)
    .query(async ({ ctx, input }) => {
      const shipment = await ctx.prisma.shipment.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        include: {
          assignment: {
            select: {
              id: true,
              startDate: true,
              vehicle: {
                select: { id: true, plateNumber: true, make: true, model: true, status: true },
              },
              driver: { select: { id: true, name: true, phone: true, status: true } },
            },
          },
          events: {
            include: { creator: { select: { id: true, name: true } } },
            orderBy: [{ createdAt: "asc" }],
          },
          route: { select: { id: true, name: true, totalDistanceKm: true } },
        },
      });
      if (!shipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shipment not found" });
      }
      return shipment;
    }),

  /**
   * Create a shipment with an auto-generated tracking number. Audited.
   */
  create: auditedProcedure({
    permission: "shipment.create",
    resource: "shipment",
    action: "CREATE",
    resourceId: (_input, result) =>
      (result as { id?: string } | null | undefined)?.id ?? null,
    metadata: (input) => {
      const s = input as {
        customerName?: string;
        originAddress?: string;
        destinationAddress?: string;
        cargoType?: string;
      };
      return {
        customerName: s.customerName ?? "",
        origin: s.originAddress ?? "",
        destination: s.destinationAddress ?? "",
        cargoType: s.cargoType ?? "",
      };
    },
  })
    .input(createShipmentSchema)
    .mutation(async ({ ctx, input }) => {
      let trackingNumber = generateTrackingNumber(ctx.organization.country);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const exists = await ctx.prisma.shipment.findUnique({
          where: { trackingNumber },
          select: { id: true },
        });
        if (!exists) break;
        trackingNumber = generateTrackingNumber(ctx.organization.country);
      }

      const { routeId, ...data } = input;

      // If a route template is chosen, make sure it belongs to this org and is
      // not already linked to another shipment before wiring it up.
      if (routeId) {
        const route = await ctx.prisma.route.findFirst({
          select: { id: true, shipmentId: true },
          where: { id: routeId, organizationId: ctx.organizationId },
        });
        if (!route) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Route not found" });
        }
        if (route.shipmentId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That route is already linked to another shipment",
          });
        }
      }

      return ctx.prisma.$transaction(async (tx) => {
        const shipment = await tx.shipment.create({
          data: {
            organizationId: ctx.organizationId,
            trackingNumber,
            ...data,
            ...(routeId ? { routeId } : {}),
          },
          include: {
            events: { select: { id: true } },
          },
        });

        if (routeId) {
          await tx.route.update({
            where: { id: routeId },
            data: { shipmentId: shipment.id },
          });
        }

        return shipment;
      }).then(async (shipment) => {
        // Shipment created → give the customer the public tracking link. Email
        // / SMS delivery is a placeholder (Resend/Africa's Talking not wired);
        // the URL works immediately from the portal.
        await sendTrackingLinkPlaceholder({
          trackingNumber: shipment.trackingNumber,
          customerName: shipment.customerName,
          customerEmail: shipment.customerEmail,
          customerPhone: shipment.customerPhone,
        });
        return shipment;
      });
    }),

  /**
   * Update shipment metadata (cargo, addresses, customer, dates). Shipment id
   * and tracking number are immutable. Audited.
   */
  update: auditedProcedure({
    permission: "shipment.create",
    resource: "shipment",
    action: "UPDATE",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
  })
    .input(updateShipmentSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, routeId, ...data } = input;
      const existing = await ctx.prisma.shipment.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shipment not found" });
      }

      return ctx.prisma.$transaction(async (tx) => {
        let targetRouteId = existing.routeId;

        if (routeId !== undefined && routeId !== existing.routeId) {
          if (routeId) {
            const route = await tx.route.findFirst({
              select: { id: true, shipmentId: true },
              where: { id: routeId, organizationId: ctx.organizationId },
            });
            if (!route) {
              throw new TRPCError({ code: "NOT_FOUND", message: "Route not found" });
            }
            if (route.shipmentId && route.shipmentId !== id) {
              throw new TRPCError({
                code: "CONFLICT",
                message: "That route is already linked to another shipment",
              });
            }
            await tx.route.update({
              where: { id: routeId },
              data: { shipmentId: id },
            });
          } else if (existing.routeId) {
            await tx.route.update({
              where: { id: existing.routeId },
              data: { shipmentId: null },
            });
          }
          targetRouteId = routeId;
        }

        return tx.shipment.update({
          where: { id },
          data: {
            ...data,
            ...(targetRouteId !== existing.routeId ? { routeId: targetRouteId } : {}),
          },
        });
      });
    }),

  /**
   * Advance (or cancel/return) a shipment's status. Rejects backwards or
   * same-status moves, logs a STATUS_CHANGED event, and stamps delivery time.
   * Audited.
   */
  updateStatus: auditedProcedure({
    permission: "shipment.update_status",
    resource: "shipment",
    action: "STATUS_CHANGED",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
    metadata: (input) => {
      const s = input as { status?: string };
      return { to: s.status ?? "" };
    },
  })
    .input(updateShipmentStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const shipment = await ctx.prisma.shipment.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      if (!shipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shipment not found" });
      }

      const allowed = NEXT_SHIPMENT_STATUSES[shipment.status] ?? [];
      if (input.status === shipment.status) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Shipment is already ${input.status}`,
        });
      }
      if (!allowed.includes(input.status)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot move this shipment from ${shipment.status} to ${input.status}`,
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.shipment.update({
          where: { id: shipment.id },
          data: {
            status: input.status,
            ...(input.status === "DELIVERED"
              ? { actualDeliveredAt: new Date() }
              : {}),
          },
        });

        await tx.shipmentEvent.create({
          data: {
            organizationId: ctx.organizationId,
            shipmentId: shipment.id,
            eventType: "STATUS_CHANGED",
            description: `Status changed from ${shipment.status} to ${input.status}`,
            createdById: ctx.user.id,
          },
        });

        // Stamp the real arrival time onto open ETA predictions so the
        // predicted-vs-actual history is measurable.
        if (input.status === "DELIVERED") {
          await stampDeliveredAt(tx, ctx.organizationId, shipment.id, updated.actualDeliveredAt ?? new Date());
        }

        // let team members with shipment visibility know the status changed
        await notifyByPermission(tx, {
          organizationId: ctx.organizationId,
          type: "SHIPMENT_STATUS_CHANGE",
          title: `Shipment ${updated.trackingNumber} is now ${getShipmentStatusLabel(input.status)}`,
          body: `Status changed from ${getShipmentStatusLabel(shipment.status)} to ${getShipmentStatusLabel(input.status)} · ${shipment.customerName}`,
          link: `/shipments/${shipment.id}`,
          excludeUserId: ctx.user.id,
        });

        return updated;
      });
    }),

  /**
   * Link a shipment to an active vehicle–driver assignment. Audited.
   */
  assign: auditedProcedure({
    permission: "shipment.update_status",
    resource: "shipment",
    action: "ASSIGNED",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
    metadata: (input) => {
      const s = input as { assignmentId?: string };
      return { assignmentId: s.assignmentId ?? "" };
    },
  })
    .input(assignShipmentSchema)
    .mutation(async ({ ctx, input }) => {
      const [shipment, assignment] = await Promise.all([
        ctx.prisma.shipment.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
        }),
        ctx.prisma.vehicleAssignment.findFirst({
          where: { id: input.assignmentId, organizationId: ctx.organizationId },
          include: {
            vehicle: { select: { plateNumber: true } },
            driver: { select: { name: true } },
          },
        }),
      ]);

      if (!shipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shipment not found" });
      }
      if (!assignment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Assignment not found" });
      }
      if (assignment.status !== "ACTIVE") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Only an active vehicle–driver assignment can be linked",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.shipment.update({
          where: { id: shipment.id },
          data: { assignmentId: assignment.id },
        });

        await tx.shipmentEvent.create({
          data: {
            organizationId: ctx.organizationId,
            shipmentId: shipment.id,
            eventType: "ASSIGNED",
            description: `Assigned to ${assignment.driver.name} in ${assignment.vehicle.plateNumber}`,
            createdById: ctx.user.id,
          },
        });

        return updated;
      });
    }),

  /**
   * Log a manual event (checkpoint reached, note, incident). Audited.
   */
  addEvent: auditedProcedure({
    permission: "shipment.update_status",
    resource: "shipment",
    action: "EVENT_LOGGED",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
  })
    .input(addShipmentEventSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, eventType, description, location, latitude, longitude } = input;
      const shipment = await ctx.prisma.shipment.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });
      if (!shipment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Shipment not found" });
      }
      return ctx.prisma.shipmentEvent.create({
        data: {
          organizationId: ctx.organizationId,
          shipmentId: shipment.id,
          eventType,
          description,
          location,
          latitude,
          longitude,
          createdById: ctx.user.id,
        },
      });
    }),
});