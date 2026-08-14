import { TRPCError } from "@trpc/server";
import { createTRPCRouter, requirePermission, auditedProcedure } from "@/trpc/init";
import {
  assignDriverSchema,
  unassignDriverSchema,
  listAssignmentsSchema,
} from "@/lib/validators/assignment";

/**
 * Vehicle–driver assignment.
 *
 * A driver can be assigned to at most one vehicle at a time, and a vehicle to
 * at most one driver. Assigning auto-updates both statuses (vehicle ->
 * IN_USE, driver -> ASSIGNED); unassigning returns them to AVAILABLE.
 * Suspended drivers and decommissioned/maintenance vehicles cannot be
 * assigned. All writes are audited.
 */
export const assignmentRouter = createTRPCRouter({
  /**
   * Paginated assignment history with optional active/ended filter.
   */
  list: requirePermission("fleet.view")
    .input(listAssignmentsSchema)
    .query(async ({ ctx, input }) => {
      const page = Math.max(1, input.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
      const skip = (page - 1) * pageSize;

      const where = {
        organizationId: ctx.organizationId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.vehicleId ? { vehicleId: input.vehicleId } : {}),
        ...(input.driverId ? { driverId: input.driverId } : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.vehicleAssignment.findMany({
          where,
          include: {
            vehicle: { select: { id: true, plateNumber: true, make: true, model: true } },
            driver: { select: { id: true, name: true, phone: true } },
          },
          orderBy: [{ startDate: "desc" }],
          skip,
          take: pageSize,
        }),
        ctx.prisma.vehicleAssignment.count({ where }),
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
   * The single active assignment for a vehicle (null if unassigned).
   */
  getActiveForVehicle: requirePermission("fleet.view")
    .input(unassignDriverSchema)
    .query(async ({ ctx, input }) => {
      return ctx.prisma.vehicleAssignment.findFirst({
        where: {
          organizationId: ctx.organizationId,
          vehicleId: input.assignmentId,
          status: "ACTIVE",
        },
        include: {
          driver: { select: { id: true, name: true, phone: true, status: true } },
        },
      });
    }),

  /**
   * The single active assignment for a driver (null if unassigned).
   */
  getActiveForDriver: requirePermission("driver.view")
    .input(unassignDriverSchema)
    .query(async ({ ctx, input }) => {
      return ctx.prisma.vehicleAssignment.findFirst({
        where: {
          organizationId: ctx.organizationId,
          driverId: input.assignmentId,
          status: "ACTIVE",
        },
        include: {
          vehicle: {
            select: { id: true, plateNumber: true, make: true, model: true, status: true },
          },
        },
      });
    }),

  /**
   * Assign a driver to a vehicle. Audited. Auto-updates statuses.
   */
  assign: auditedProcedure({
    permission: "fleet.manage",
    resource: "vehicle_assignment",
    action: "ASSIGN",
    resourceId: (_input, result) =>
      (result as { id?: string } | null | undefined)?.id ?? null,
    metadata: (input) => {
      const a = input as { vehicleId?: string; driverId?: string };
      return { vehicleId: a.vehicleId ?? "", driverId: a.driverId ?? "" };
    },
  })
    .input(assignDriverSchema)
    .mutation(async ({ ctx, input }) => {
      const [vehicle, driver] = await Promise.all([
        ctx.prisma.vehicle.findFirst({
          where: { id: input.vehicleId, organizationId: ctx.organizationId },
        }),
        ctx.prisma.driver.findFirst({
          where: { id: input.driverId, organizationId: ctx.organizationId },
        }),
      ]);

      if (!vehicle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vehicle not found" });
      }
      if (!driver) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Driver not found" });
      }

      if (vehicle.status === "DECOMMISSIONED") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A decommissioned vehicle cannot be assigned",
        });
      }
      if (vehicle.status === "MAINTENANCE") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A vehicle in maintenance cannot be assigned",
        });
      }
      if (driver.status === "SUSPENDED") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A suspended driver cannot be assigned",
        });
      }
      if (driver.licenseExpiry.getTime() < Date.now()) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This driver's licence has expired and cannot be assigned",
        });
      }

      const [activeForDriver, activeForVehicle] = await Promise.all([
        ctx.prisma.vehicleAssignment.findFirst({
          where: {
            organizationId: ctx.organizationId,
            driverId: driver.id,
            status: "ACTIVE",
          },
          select: { id: true, vehicle: { select: { plateNumber: true } } },
        }),
        ctx.prisma.vehicleAssignment.findFirst({
          where: {
            organizationId: ctx.organizationId,
            vehicleId: vehicle.id,
            status: "ACTIVE",
          },
          select: { id: true, driver: { select: { name: true } } },
        }),
      ]);

      if (activeForDriver) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${driver.name} is already assigned to ${activeForDriver.vehicle.plateNumber}. Unassign them first.`,
        });
      }
      if (activeForVehicle) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${vehicle.plateNumber} is already assigned to ${activeForVehicle.driver.name}. Unassign them first.`,
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const assignment = await tx.vehicleAssignment.create({
          data: {
            organizationId: ctx.organizationId,
            vehicleId: vehicle.id,
            driverId: driver.id,
            status: "ACTIVE",
            notes: input.notes ?? null,
          },
        });

        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: { status: "IN_USE" },
        });
        await tx.driver.update({
          where: { id: driver.id },
          data: { status: "ASSIGNED" },
        });

        return assignment;
      });
    }),

  /**
   * End an active assignment. Audited. Returns vehicle + driver to AVAILABLE.
   */
  unassign: auditedProcedure({
    permission: "fleet.manage",
    resource: "vehicle_assignment",
    action: "UNASSIGN",
    resourceId: (input) => (input as { assignmentId?: string })?.assignmentId ?? null,
  })
    .input(unassignDriverSchema)
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.prisma.vehicleAssignment.findFirst({
        where: {
          id: input.assignmentId,
          organizationId: ctx.organizationId,
          status: "ACTIVE",
        },
      });
      if (!assignment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active assignment not found",
        });
      }

      return ctx.prisma.$transaction(async (tx) => {
        const ended = await tx.vehicleAssignment.update({
          where: { id: assignment.id },
          data: { status: "ENDED", endDate: new Date() },
        });

        await tx.vehicle.updateMany({
          where: { id: assignment.vehicleId, status: "IN_USE" },
          data: { status: "AVAILABLE" },
        });
        await tx.driver.updateMany({
          where: { id: assignment.driverId, status: "ASSIGNED" },
          data: { status: "AVAILABLE" },
        });

        return ended;
      });
    }),
});
