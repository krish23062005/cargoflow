import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma/client";
import { createTRPCRouter, requirePermission, auditedProcedure } from "@/trpc/init";
import {
  createVehicleSchema,
  updateVehicleSchema,
  archiveVehicleSchema,
  listVehiclesSchema,
  vehicleIdSchema,
} from "@/lib/validators/vehicle";
import type { Prisma as PrismaTypes } from "@/generated/prisma/client";

/**
 * Fleet management. Viewing is available to any role with `fleet.view`
 * (owner, admin, dispatcher, viewer); writes require `fleet.manage`
 * (owner, admin, dispatcher). All writes are audited.
 */
export const fleetRouter = createTRPCRouter({
  /**
   * Paginated fleet list with search + type/status filters.
   */
  list: requirePermission("fleet.view")
    .input(listVehiclesSchema)
    .query(async ({ ctx, input }) => {
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: PrismaTypes.VehicleWhereInput = {
      organizationId: ctx.organizationId,
      ...(input.search
        ? {
            OR: [
              { plateNumber: { contains: input.search, mode: "insensitive" } },
              { make: { contains: input.search, mode: "insensitive" } },
              { model: { contains: input.search, mode: "insensitive" } },
              { vin: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.status ? { status: input.status } : {}),
    };

    const [items, total] = await Promise.all([
      ctx.prisma.vehicle.findMany({
        where,
        orderBy: [{ status: "asc" }, { plateNumber: "asc" }],
        skip,
        take: pageSize,
      }),
      ctx.prisma.vehicle.count({ where }),
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
   * Fleet summary counts for dashboards and KPIs.
   */
  summary: requirePermission("fleet.view").query(async ({ ctx }) => {
    const byStatus = await ctx.prisma.vehicle.groupBy({
      by: ["status"],
      where: { organizationId: ctx.organizationId },
      _count: { _all: true },
    });
    const total = byStatus.reduce((sum, g) => sum + g._count._all, 0);
    const statusCounts = Object.fromEntries(
      byStatus.map((g) => [g.status, g._count._all]),
    );
    return {
      total,
      available: statusCounts["AVAILABLE"] ?? 0,
      inTransit: statusCounts["IN_TRANSIT"] ?? 0,
      maintenance: statusCounts["MAINTENANCE"] ?? 0,
      decommissioned: statusCounts["DECOMMISSIONED"] ?? 0,
    };
  }),

  /**
   * Single vehicle by id (org-scoped).
   */
  get: requirePermission("fleet.view")
    .input(vehicleIdSchema)
    .query(async ({ ctx, input }) => {
      const vehicle = await ctx.prisma.vehicle.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      if (!vehicle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle not found" });
      }
      return vehicle;
    }),

  /**
   * Create a vehicle. Audited.
   */
  create: auditedProcedure({
    permission: "fleet.manage",
    resource: "vehicle",
    action: "CREATE",
    resourceId: () => null,
    metadata: (input) => {
      const v = input as { plateNumber?: string; make?: string; model?: string; type?: string };
      return {
        plateNumber: v.plateNumber ?? "",
        make: v.make ?? "",
        model: v.model ?? "",
        type: v.type ?? "",
      };
    },
  })
    .input(createVehicleSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.prisma.vehicle.create({
          data: {
            organizationId: ctx.organizationId,
            ...input,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A vehicle with plate ${input.plateNumber} already exists`,
          });
        }
        throw error;
      }
    }),

  /**
   * Update a vehicle. Audited. The vehicle id itself is immutable.
   */
  update: auditedProcedure({
    permission: "fleet.manage",
    resource: "vehicle",
    action: "UPDATE",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
  })
    .input(updateVehicleSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.prisma.vehicle.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle not found" });
      }
      try {
        return await ctx.prisma.vehicle.update({
          where: { id },
          data,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `A vehicle with plate ${data.plateNumber} already exists`,
          });
        }
        throw error;
      }
    }),

  /**
   * Archive (decommission) a vehicle. Audited.
   */
  archive: auditedProcedure({
    permission: "fleet.manage",
    resource: "vehicle",
    action: "DELETE",
    resourceId: (input) => (input as { id?: string })?.id ?? null,
  })
    .input(archiveVehicleSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.vehicle.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle not found" });
      }
      return ctx.prisma.vehicle.update({
        where: { id: input.id },
        data: { status: "DECOMMISSIONED" },
      });
    }),
});
